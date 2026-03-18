from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    openai_api_key: str
    tavily_api_key: str
    openai_model: str = "gpt-4o-mini"
    chroma_persist_dir: str = "./chroma_db"
    rss_refresh_interval_minutes: int = 60

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

RSS_FEEDS = [
    # {
    #     "name": "Boston Business Journal",
    #     "url": "https://rss.bizjournals.com/feed/b9ed7bf2b98724dcdf252f7cc5e9682ff9928337/14417?market=boston",
    # },
    # {
    #     "name": "Yahoo Finance",
    #     "url": "https://finance.yahoo.com/news/rssindex",
    # },
    {
        "name": "TechCrunch",
        "url": "https://techcrunch.com/feed/",
    },
    {
        "name": "Crunchbase News",
        "url": "https://news.crunchbase.com/feed/",
    },
]
