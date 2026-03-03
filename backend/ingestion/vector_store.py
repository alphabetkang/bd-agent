"""Singleton Chroma vector store."""
from functools import lru_cache

from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings

from config import settings

COLLECTION_NAME = "news_articles"


@lru_cache(maxsize=1)
def get_vector_store() -> Chroma:
    embeddings = OpenAIEmbeddings(
        model="text-embedding-3-small",
        api_key=settings.openai_api_key,
    )
    return Chroma(
        collection_name=COLLECTION_NAME,
        embedding_function=embeddings,
        persist_directory=settings.chroma_persist_dir,
    )


def get_retriever(k: int = 6):
    return get_vector_store().as_retriever(search_kwargs={"k": k})
