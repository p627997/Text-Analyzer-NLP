import os
import re
from collections import Counter
from functools import lru_cache
from typing import List, Optional

import nltk
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from nltk import pos_tag
from nltk.corpus import stopwords
from nltk.tokenize import sent_tokenize, word_tokenize
from pydantic import BaseModel, Field, field_validator
from sumy.nlp.stemmers import Stemmer
from sumy.nlp.tokenizers import Tokenizer
from sumy.parsers.plaintext import PlaintextParser
from sumy.summarizers.lex_rank import LexRankSummarizer
from sumy.summarizers.lsa import LsaSummarizer
from sumy.summarizers.text_rank import TextRankSummarizer
from sumy.utils import get_stop_words

# NLTK data download (cached after first run)
NLTK_DATA = ['punkt', 'punkt_tab', 'stopwords', 'averaged_perceptron_tagger_eng']
for resource in NLTK_DATA:
    try:
        nltk.data.find(f'tokenizers/{resource}' if 'punkt' in resource else f'taggers/{resource}' if 'tagger' in resource else f'corpora/{resource}')
    except LookupError:
        nltk.download(resource, quiet=True)

# Configuration from environment
CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',')
MIN_TEXT_LENGTH = int(os.getenv('MIN_TEXT_LENGTH', '10'))

app = FastAPI(
    title="Text Analyzer API",
    description="Text analysis and summarization service",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cached stopwords for performance
@lru_cache(maxsize=1)
def get_english_stopwords() -> frozenset:
    return frozenset(stopwords.words('english'))


# POS tag prefixes for classification
POS_CATEGORIES = {
    'nouns': ('NN',),
    'verbs': ('VB',),
    'adjectives': ('JJ',),
    'adverbs': ('RB',),
    'pronouns': ('PRP', 'WP'),
    'prepositions': ('IN',),
    'conjunctions': ('CC',),
}


# --- Pydantic Models ---

class TextRequest(BaseModel):
    text: str = Field(..., min_length=1)

    @field_validator('text')
    @classmethod
    def validate_text_length(cls, v: str) -> str:
        cleaned = re.sub(r'\s+', ' ', v).strip()
        if len(cleaned) < MIN_TEXT_LENGTH:
            raise ValueError(f'Text must be at least {MIN_TEXT_LENGTH} characters')
        return cleaned


class SummarizeRequest(BaseModel):
    text: str = Field(..., min_length=1)
    sentence_count: int = Field(default=3, ge=1, le=10)
    method: str = Field(default='smart', pattern='^(smart|lsa|lexrank|textrank)$')

    @field_validator('text')
    @classmethod
    def validate_text_length(cls, v: str) -> str:
        cleaned = re.sub(r'\s+', ' ', v).strip()
        if len(cleaned) < MIN_TEXT_LENGTH:
            raise ValueError(f'Text must be at least {MIN_TEXT_LENGTH} characters')
        return cleaned


class TextStats(BaseModel):
    word_count: int
    sentence_count: int
    avg_sentence_length: float
    avg_word_length: float
    character_count: int


class ReadabilityScore(BaseModel):
    flesch_kincaid_grade: float
    reading_level: str
    description: str


class PartsOfSpeech(BaseModel):
    nouns: List[str] = []
    verbs: List[str] = []
    adjectives: List[str] = []
    adverbs: List[str] = []
    pronouns: List[str] = []
    prepositions: List[str] = []
    conjunctions: List[str] = []


class TenseAnalysis(BaseModel):
    past: List[str] = []
    present: List[str] = []
    future: List[str] = []


class WordFrequency(BaseModel):
    word: str
    count: int


class AnalyzeResponse(BaseModel):
    text_stats: TextStats
    readability: ReadabilityScore
    parts_of_speech: PartsOfSpeech
    passive_sentences: List[str] = []
    tense_analysis: TenseAnalysis
    word_frequency: List[WordFrequency] = []


class SummarizeResponse(BaseModel):
    summary: str
    original_word_count: int
    summary_word_count: int
    reduction_percentage: float


# --- Text Processing Class ---

class TextProcessor:
    """Optimized text processor with single-pass tokenization."""

    def __init__(self, text: str):
        self.text = text
        self.sentences = sent_tokenize(text)
        self.words = word_tokenize(text)
        self.alpha_words = [w for w in self.words if w.isalpha()]
        self.tagged_words = pos_tag(self.words)
        self._stopwords = get_english_stopwords()

    def get_text_stats(self) -> TextStats:
        word_count = len(self.alpha_words)
        sentence_count = len(self.sentences)
        char_count = sum(len(w) for w in self.alpha_words)

        return TextStats(
            word_count=word_count,
            sentence_count=sentence_count,
            avg_sentence_length=round(word_count / sentence_count, 1) if sentence_count else 0,
            avg_word_length=round(char_count / word_count, 1) if word_count else 0,
            character_count=char_count
        )

    def get_readability(self) -> ReadabilityScore:
        word_count = len(self.alpha_words)
        sentence_count = len(self.sentences)

        if not word_count or not sentence_count:
            return ReadabilityScore(
                flesch_kincaid_grade=0,
                reading_level="Unknown",
                description="Not enough text to analyze"
            )

        syllable_count = sum(self._count_syllables(w) for w in self.alpha_words)
        fk_grade = 0.39 * (word_count / sentence_count) + 11.8 * (syllable_count / word_count) - 15.59
        fk_grade = round(max(0, fk_grade), 1)

        level, desc = self._get_reading_level(fk_grade)
        return ReadabilityScore(
            flesch_kincaid_grade=fk_grade,
            reading_level=level,
            description=desc
        )

    @staticmethod
    def _count_syllables(word: str) -> int:
        word = word.lower()
        vowels = "aeiouy"
        count = sum(1 for i, c in enumerate(word) if c in vowels and (i == 0 or word[i-1] not in vowels))
        if word.endswith('e') and count > 1:
            count -= 1
        return max(1, count)

    @staticmethod
    def _get_reading_level(grade: float) -> tuple:
        levels = [
            (5, "Elementary", "Very easy to read. Easily understood by 5th graders."),
            (8, "Middle School", "Easy to read. Conversational English for consumers."),
            (12, "High School", "Fairly difficult to read. Best understood by high schoolers."),
            (16, "College", "Difficult to read. Best understood by college graduates."),
            (float('inf'), "Graduate", "Very difficult to read. Best understood by university graduates.")
        ]
        for threshold, level, desc in levels:
            if grade <= threshold:
                return level, desc
        return levels[-1][1], levels[-1][2]

    def get_parts_of_speech(self) -> PartsOfSpeech:
        result = {cat: set() for cat in POS_CATEGORIES}

        for word, tag in self.tagged_words:
            if not word.isalpha():
                continue
            word_lower = word.lower()

            for category, prefixes in POS_CATEGORIES.items():
                if any(tag.startswith(p) or tag == p for p in prefixes):
                    result[category].add(word_lower)
                    break

        return PartsOfSpeech(**{k: list(v) for k, v in result.items()})

    def get_passive_sentences(self) -> List[str]:
        be_forms = frozenset(['am', 'is', 'are', 'was', 'were', 'be', 'been', 'being'])
        passive = []

        for sentence in self.sentences:
            words = word_tokenize(sentence)
            tagged = pos_tag(words)

            for i, (word, _) in enumerate(tagged):
                if word.lower() in be_forms:
                    for j in range(i + 1, min(i + 4, len(tagged))):
                        if tagged[j][1] == 'VBN':
                            passive.append(sentence)
                            break
                    else:
                        continue
                    break

        return passive

    def get_tense_analysis(self) -> TenseAnalysis:
        past, present, future = set(), set(), set()

        for i, (word, tag) in enumerate(self.tagged_words):
            if not word.isalpha():
                continue

            word_lower = word.lower()

            if tag == 'VBD':
                past.add(word_lower)
            elif tag in ('VBP', 'VBZ'):
                present.add(word_lower)
            elif word_lower in ('will', 'shall') and i + 1 < len(self.tagged_words):
                next_word, next_tag = self.tagged_words[i + 1]
                if next_tag in ('VB', 'RB') and next_word.isalpha():
                    future.add(next_word.lower())

        return TenseAnalysis(past=list(past), present=list(present), future=list(future))

    def get_word_frequency(self, top_n: int = 10) -> List[WordFrequency]:
        words = [w.lower() for w in self.alpha_words if w.lower() not in self._stopwords and len(w) > 2]
        counts = Counter(words).most_common(top_n)
        return [WordFrequency(word=w, count=c) for w, c in counts]


# --- Summarization Functions ---

def smart_summarize(text: str, target_sentences: int = 3) -> str:
    sentences = sent_tokenize(text)
    if len(sentences) <= target_sentences:
        return text

    stop_words = get_english_stopwords()
    words = [w.lower() for w in word_tokenize(text) if w.isalnum() and w.lower() not in stop_words and len(w) > 2]
    key_phrases = set(w for w, _ in Counter(words).most_common(15))

    importance_words = frozenset(['therefore', 'thus', 'hence', 'consequently', 'conclusion', 'overall', 'finally'])
    significance_words = frozenset(['important', 'significant', 'key', 'main', 'primary', 'essential', 'critical'])

    scored = []
    for i, sent in enumerate(sentences):
        sent_lower = sent.lower()
        sent_words = set(sent_lower.split())

        score = len(key_phrases & sent_words) * 2
        score += 3 if i == 0 else (1 if i == len(sentences) - 1 else 0)
        score += 2 if importance_words & sent_words else 0
        score += 1 if significance_words & sent_words else 0

        scored.append((i, sent, score))

    top = sorted(scored, key=lambda x: -x[2])[:target_sentences]
    top.sort(key=lambda x: x[0])

    summary = ' '.join(s[1] for s in top)
    summary = re.sub(r'\s+', ' ', summary)
    summary = re.sub(r'\s+([.,!?;:])', r'\1', summary)

    if summary and not summary.endswith(('.', '!', '?')):
        summary += '.'

    return summary


def extractive_summarize(text: str, sentence_count: int, method: str) -> str:
    parser = PlaintextParser.from_string(text, Tokenizer("english"))
    stemmer = Stemmer("english")
    stop_words = get_stop_words("english")

    summarizers = {
        'lsa': LsaSummarizer,
        'lexrank': LexRankSummarizer,
        'textrank': TextRankSummarizer,
    }

    summarizer_class = summarizers.get(method, LexRankSummarizer)
    summarizer = summarizer_class(stemmer)
    summarizer.stop_words = stop_words

    summary_sentences = summarizer(parser.document, sentence_count)

    # Preserve original order
    original = [str(s) for s in parser.document.sentences]
    summary_set = {str(s) for s in summary_sentences}
    ordered = [s for s in original if s in summary_set]

    return " ".join(ordered) if ordered else " ".join(str(s) for s in summary_sentences)


# --- API Endpoints ---

@app.get("/")
async def root():
    return {
        "message": "Text Analyzer API",
        "version": "2.0.0",
        "docs": "/docs",
        "endpoints": {
            "analyze": "POST /api/analyze/",
            "summarize": "POST /api/summarize/"
        }
    }


@app.post("/api/analyze/", response_model=AnalyzeResponse)
async def analyze_text(request: TextRequest):
    try:
        processor = TextProcessor(request.text)

        return AnalyzeResponse(
            text_stats=processor.get_text_stats(),
            readability=processor.get_readability(),
            parts_of_speech=processor.get_parts_of_speech(),
            passive_sentences=processor.get_passive_sentences(),
            tense_analysis=processor.get_tense_analysis(),
            word_frequency=processor.get_word_frequency()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/api/summarize/", response_model=SummarizeResponse)
async def summarize_text(request: SummarizeRequest):
    try:
        if request.method == 'smart':
            summary = smart_summarize(request.text, request.sentence_count)
        else:
            summary = extractive_summarize(request.text, request.sentence_count, request.method)

        original_words = len(request.text.split())
        summary_words = len(summary.split())
        reduction = round((1 - summary_words / original_words) * 100, 1) if original_words else 0

        return SummarizeResponse(
            summary=summary,
            original_word_count=original_words,
            summary_word_count=summary_words,
            reduction_percentage=reduction
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Summarization failed: {str(e)}")


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
