# Local RunPod Simulation Architecture

## Poster Version (Simplified)

```mermaid
graph TB
    Dev[Local Development<br/>No GPU Required]
    Proxy[RunPod Proxy<br/>Simulates Cloud API]
    Workers[ML Workers<br/>Assessment & IPA Generation]
    App[Frontend Application]
    
    Dev -->|"Starts"| Proxy
    Dev -->|"Starts"| Workers
    
    App -->|"API Request"| Proxy
    Proxy -->|"Process"| Workers
    Workers -->|"Result"| Proxy
    Proxy -->|"Response"| App
    
    style Proxy fill:#e1f5ff
    style Workers fill:#fff4e1
    style App fill:#e8f5e9
    style Dev fill:#f3e5f5
```

## Detailed Version

```mermaid
graph TB
    subgraph "Local Development Environment (No GPU Required)"
        Dev[Developer<br/>scripts/runpod.py]
        Compose[Docker Compose<br/>docker-compose.dev.yml]
    end
    
    subgraph "Docker Network: runpod-net"
        subgraph "Proxy Service (Port 8008)"
            Proxy[RunPod Proxy<br/>FastAPI Server<br/>Mimics RunPod Cloud API]
            Queue1[Job Queue<br/>pronunciation-assessment]
            Queue2[Job Queue<br/>ipa-generation]
        end
        
        subgraph "Worker Services"
            Worker1[Assessment Worker<br/>Port 8001<br/>POWSM + MFA]
            Worker2[IPA Generation Worker<br/>Port 8002<br/>G2P Model]
        end
    end
    
    subgraph "Frontend Application"
        App[TanStack App<br/>Fly.io Deployment]
    end
    
    Dev -->|"docker compose up"| Compose
    Compose -->|"Starts Services"| Proxy
    Compose -->|"Starts Services"| Worker1
    Compose -->|"Starts Services"| Worker2
    
    App -->|"POST /v2/pronunciation-assessment/run<br/>POST /v2/ipa-generation/run"| Proxy
    Proxy -->|"Routes to Queue"| Queue1
    Proxy -->|"Routes to Queue"| Queue2
    
    Queue1 -->|"Worker Loop<br/>Pulls Jobs"| Worker1
    Queue2 -->|"Worker Loop<br/>Pulls Jobs"| Worker2
    
    Worker1 -->|"Returns Results"| Proxy
    Worker2 -->|"Returns Results"| Proxy
    
    Proxy -->|"GET /v2/{endpoint}/status/{job_id}<br/>or Webhook"| App
    
    style Proxy fill:#e1f5ff
    style Worker1 fill:#fff4e1
    style Worker2 fill:#fff4e1
    style App fill:#e8f5e9
    style Dev fill:#f3e5f5
```

## Description

**Development without GPU**: The development of the project was done without a GPU. Additionally, in order to save cost and keep the pace of development fast, RunPod Serverless endpoints were simulated locally via a proxy server.

**Architecture Flow**:
1. Developer runs `scripts/runpod.py` to start Docker Compose services locally
2. RunPod Proxy mimics the RunPod Cloud API interface, accepting requests from the frontend
3. Proxy routes requests to appropriate worker containers (Assessment or IPA Generation)
4. Workers process requests and return results through the proxy
5. Frontend receives status updates or webhook notifications

This architecture enables cost-effective local development while maintaining compatibility with the production RunPod Serverless API structure.

