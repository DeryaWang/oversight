# Oversight Local Operations Guide

This project provides a robust research search pipeline integrated with GraphRAG and multi-agent query decomposition.

## 1. System Architecture
- **Backend**: Flask API server managing retrieval and re-ranking.
- **Retrieval Engine**: LinearRAG (Graph-based search using local data in `data/`).
- **Query Decomposition Agent**: Optional multi-branch query analysis (Round 1 & 2).
- **Semantic Reranker**: Integrated BAAI/bge-reranker-v2-m3 Cross-Encoder for deep semantic scoring.

## 2. Environment Setup

### 2.1 Python Environment (Conda)
```bash
conda env create -f environment.local.yml
conda activate oversight-local
```

### 2.2 Node.js (Frontend)
It is recommended to use Node.js 18 for stability with Next.js 12:
```bash
conda install -n oversight-local -c conda-forge -y "nodejs=18.x"
```

### 2.3 Core Dependencies
Install additional requirements for LinearRAG and the Reranker:
```bash
pip install sentence-transformers spacy python-igraph FlagEmbedding torch
python -m spacy download en_core_web_sm
```

## 3. Configuration (Environment Variables)

Configure these in your `.env` file or export them in your terminal session.

### 3.1 LinearRAG Configuration (Required)
```env
LINEAR_RAG_DATA_DIR=./data
LINEAR_RAG_ROOT=./LinearRAG
LINEAR_RAG_WORKING_DIR=./LinearRAG/import
LINEAR_RAG_DATASET_NAME=oversight_data
LINEAR_RAG_EMBEDDING_MODEL=all-MiniLM-L6-v2
LINEAR_RAG_SPACY_MODEL=en_core_web_sm
LINEAR_RAG_MAX_WORKERS=1
```

### 3.2 Semantic Reranker Configuration (New)
Enable this to use the Cross-Encoder for improved search precision:
```env
OVERSIGHT_RERANK_ENABLED=true
OVERSIGHT_RERANK_MODEL=BAAI/bge-reranker-v2-m3
OVERSIGHT_RERANK_FP16=true
OVERSIGHT_RERANK_TOP_K=10
```

### 3.3 Query Decomposition Agent (Optional)
If not configured, the system defaults to single-query search mode.

#### Remote Mode (OpenAI-compatible)
```env
LOCAL_AGENT_ENABLED=true
LOCAL_AGENT_DEBUG=true
QUERY_DECOMPOSITION_AGENT_MODE=remote
API_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
API_KEY=your_key_here
REMOTE_AGENT_LLM_MODEL=qwen-max
REMOTE_AGENT_LLM_TIMEOUT_SECONDS=60
```

## 4. Running the Application

### 4.1 Start the Backend
```bash
# Set Flask port and run the server
FLASK_PORT=5001 python flask_app.py
```

### 4.2 Start the Frontend
In a new terminal:
```bash
cd frontend
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:5001 npm run dev
```
Access the UI at `http://localhost:3000`.

## 5. UI Features
- **Semantic Rerank Toggle**: Found in the sidebar under "Settings". Enable this to trigger deep semantic re-scoring of search results.
- **Find Similar**: Click on any paper card to perform a new search using that paper's abstract.
- **Branch Visualization**: View the decomposition of your query into multiple search strategies.
