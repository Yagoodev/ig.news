import { NextApiRequest, NextApiResponse } from "next";
import { Readable } from "stream";

import { stripe } from "../../services/stripe";

import { saveSubscription } from "./_lib/manageSubscription";

import Stripe from "stripe";

async function buffer(readable: Readable) {
  const chunks = [];

  for await (const chunk of readable) {
    chunks.push(
      typeof chunk === "string" ? Buffer.from(chunk) : chunk
    );
  }

  return Buffer.concat(chunks);
}

// Desabilita o entendimento padrão do Next (Que espera um JSON das requisições) para que ele espere um readable

export const config = {
  api: {
    bodyParser: false
  }
}

// Sintaxe de criação de array para que não possa haver valores dúplicados
// Criamos esse array para armazenar apenas os tipos de respostas relevantes dos eventos do Stripe

const relevantEvents = new Set([
  "checkout.session.completed",
  "customer.subscriptions.updated",
  "customer.subscriptions.deleted"
]);

export default async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method === "POST") {
    const buf = await buffer(req);

    // Campo de webhook que o stripe nos envia
    const secret = req.headers["stripe-signature"]

    // Verifica se o que vem do cabeçalho do stripe bate com a secret key que nós temos ao iniciar a comunicação com o stripe
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(buf, secret, process.env.STRIPE_WEBHOOK_SECRET);

    } catch (err) {
      return res.status(400).send(`Webhook error: ${err.message}`);
    }

    const { type } = event;

    if (relevantEvents.has(type)) {
      try {
        switch (type) {
          case "customer.subscription.updated":
          case "customer.subscription.deleted":

            const subscription = event.data.object as Stripe.Subscription;

            await saveSubscription(
              subscription.id,
              subscription.customer.toString(),
              false
            );

            break;
          case "checkout.session.completed":

            // Tipando essa constando para que o typescript entenda o que vem de dado caso seja checkout.session.completed for true
            const checkoutSession = event.data.object as Stripe.Checkout.Session

            await saveSubscription(
              checkoutSession.subscription.toString(),
              checkoutSession.customer.toString(),
              true
            );

            break;
          default:
            throw new Error("Unhandled event.");
        }
      } catch (err) {
        return res.json({ error: "Webhook handler filed." });
      }
    }

    res.json({ received: true });

  } else {
    res.setHeader("Allow", "POST");
    res.status(405).end("Method not allowed");
  }
}