import { GetServerSideProps } from "next";
import { getSession } from "next-auth/client";
import Head from "next/head";

import { getPrismicClient } from "../../services/prismic";

import { RichText } from "prismic-dom";

import styles from "./post.module.scss";

interface PostProps {
  post: {
    slug: string;
    title: string;
    content: string;
    updatedAt: string;
  }
}

export default function Post({ post }: PostProps) {
  return (
    <>
      <Head>
        <title>{post.title} | Ignews</title>
      </Head>

      <main className={styles.container}>
        <article className={styles.post}>
          <h1>{post.title}</h1>
          <time>{post.updatedAt}</time>
          <div
            dangerouslySetInnerHTML={{ __html: post.content }}
            className={styles.postContent}
          />
        </article>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req, params }) => {

  const session = getSession({ req }); // Nos da informação da pessoa logada na aplicação.
  const { slug } = params; // Recupera o valor passado na URL da aplicação.

  const prismic = getPrismicClient(req);
  const response = await prismic.getByUID<any>("publication-id", String(slug), {});

  const post = {
    slug,
    title: response.data.title,
    content: RichText.asHtml(response.data.content),
    updatedAt: new Date(response.last_publication_date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    }),
  }

  return {
    props: {
      post
    }
  }
};