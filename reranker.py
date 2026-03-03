import time
import logging
from typing import List, Dict, Any
from FlagEmbedding import FlagReranker

logger = logging.getLogger(__name__)

class BGEReranker:
    """
    Provides semantic re-ranking using the BAAI/bge-reranker-v2-m3 Cross-Encoder.
    This implementation is optimized for high-performance GPUs (e.g., NVIDIA L40S)
    using FP16 precision and batch processing.
    """

    def __init__(self, model_name: str = 'BAAI/bge-reranker-v2-m3', use_fp16: bool = True):
        """
        Initialize the Cross-Encoder model.

        Args:
            model_name: The HuggingFace model identifier.
            use_fp16: Enable half-precision to reduce VRAM usage and increase throughput.
        """
        logger.info("Initializing Reranker: %s (FP16=%s)", model_name, use_fp16)
        try:
            self.reranker = FlagReranker(model_name, use_fp16=use_fp16)
            logger.info("Reranker model loaded successfully.")
        except Exception as e:
            logger.error("Failed to load reranker model: %s", str(e))
            self.reranker = None

    def rerank(self, query: str, papers: List[Dict[str, Any]], top_k: int = 50) -> List[Dict[str, Any]]:
        """
        Scores a list of papers against a query and returns the top-K results sorted by relevance.

        Args:
            query: The original user query or a decomposed subquery.
            papers: A list of dictionaries, each containing 'title' and 'abstract'.
            top_k: The number of results to return after re-ranking.

        Returns:
            A list of papers sorted by semantic_score in descending order.
        """
        if not self.reranker or not papers:
            return papers[:top_k]

        # Construct input pairs: [query, title + abstract]
        sentence_pairs = []
        for paper in papers:
            title = paper.get('title', '')
            abstract = paper.get('abstract', '')
            # Concatenate title and abstract for maximum context
            context = f"{title}. {abstract}"
            sentence_pairs.append([query, context])

        start_time = time.time()
        # Compute scores with normalization to map logits to 0.0 - 1.0 range
        scores = self.reranker.compute_score(sentence_pairs, normalize=True)
        duration = time.time() - start_time

        logger.info("Reranked %d papers in %.4f seconds", len(papers), duration)

        # Ensure scores is a list even for single inputs
        if isinstance(scores, float):
            scores = [scores]

        # Assign scores and sort
        for i, paper in enumerate(papers):
            paper['semantic_score'] = float(scores[i])

        sorted_papers = sorted(papers, key=lambda x: x.get('semantic_score', 0.0), reverse=True)
        return sorted_papers[:top_k]
