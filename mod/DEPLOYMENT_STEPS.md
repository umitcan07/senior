# Deployment Steps - Step by Step Guide

This document outlines the manual steps you need to perform to deploy the endpoints to RunPod.

## Prerequisites

1. Docker installed and running
2. Docker Hub account (or other container registry)
3. RunPod account with API access
4. Docker images built and pushed to registry

## Step 1: Build Docker Images

Navigate to the `mod/` directory and build both Docker images.
**Important**: Build context is `mod/` directory, not the monorepo root.

```bash
cd mod/

# Build assessment image (build context is mod/ directory)
# Note: --platform linux/amd64 is required when building on Apple Silicon (M1/M2/M3)
docker build --platform linux/amd64 -f assessment/Dockerfile -t ucede/nonce-assessment:latest .

# Build IPA generation image (build context is mod/ directory)
docker build --platform linux/amd64 -f ipa_generation/Dockerfile -t ucede/nonce-generation:latest .

# Tag with version (optional but recommended)
docker tag ucede/nonce-assessment:latest ucede/nonce-assessment:v1.0.0
docker tag ucede/nonce-generation:latest ucede/nonce-generation:v1.0.0
```

## Step 2: Push Images to Docker Registry

```bash
# Login to Docker Hub (or your registry)
docker login

# Push assessment image
docker push ucede/nonce-assessment:latest
docker push ucede/nonce-assessment:v1.0.0

# Push IPA generation image
docker push ucede/nonce-generation:latest
docker push ucede/nonce-generation:v1.0.0
```

**Note**: Replace `ucede` with your Docker Hub username or use your own container registry.

## Step 3: Deploy Assessment Endpoint on RunPod

1. Navigate to [RunPod Serverless Console](https://www.console.runpod.io/serverless)
2. Click **"New Endpoint"**
3. Select **"Import from Docker Registry"**
4. Enter Docker image: `ucede/nonce-assessment:latest` (or your registry path)
5. Configure endpoint settings:
   - **Endpoint Name**: `pronunciation-assessment`
   - **Endpoint Type**: `Queue`
   - **Container Start Command**: `python assessment/handler.py`
   - **GPU Configuration**: 
     - Primary: L4/A5000/3090 (24GB)
     - Fallback: 4090 PRO
   - **Active Workers**: `1-2`
   - **Max Workers**: `5-10`
   - **Execution Timeout**: `600` seconds
   - **Auto-scaling**: 
     - Type: `Queue delay`
     - Threshold: `4` seconds
   - **FlashBoot**: `Enabled`
6. Click **"Create Endpoint"**
7. Note the endpoint ID and API endpoint URL

## Step 4: Deploy IPA Generation Endpoint on RunPod

1. Navigate to [RunPod Serverless Console](https://www.console.runpod.io/serverless)
2. Click **"New Endpoint"**
3. Select **"Import from Docker Registry"**
4. Enter Docker image: `ucede/nonce-generation:latest` (or your registry path)
5. Configure endpoint settings:
   - **Endpoint Name**: `ipa-generation`
   - **Endpoint Type**: `Queue`
   - **Container Start Command**: `python ipa_generation/handler.py`
   - **GPU Configuration**: 
     - Primary: A4000/A4500/RTX 4000 (16GB)
     - Fallback: L4/A5000
   - **Active Workers**: `0-1`
   - **Max Workers**: `2-3`
   - **Execution Timeout**: `120` seconds
   - **Auto-scaling**: 
     - Type: `Request count`
     - Scaler value: `2-3`
   - **FlashBoot**: `Optional` (disable if traffic is infrequent)
6. Click **"Create Endpoint"**
7. Note the endpoint ID and API endpoint URL

## Step 5: Test Endpoints

### Test Assessment Endpoint

```bash
# Using curl
curl -X POST https://api.runpod.io/v2/YOUR_ENDPOINT_ID/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_RUNPOD_API_KEY" \
  -d '{
    "input": {
      "audio_uri": "https://example.com/audio.wav",
      "target_ipa": "hɛloʊ wɜrld"
    }
  }'
```

### Test IPA Generation Endpoint

```bash
# Using curl
curl -X POST https://api.runpod.io/v2/YOUR_ENDPOINT_ID/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_RUNPOD_API_KEY" \
  -d '{
    "input": {
      "text": "hello world",
      "audio_uri": "https://example.com/audio.wav"
    }
  }'
```

## Step 6: Update Frontend/API Integration

Update your frontend or API code to use the new endpoint URLs:

- Assessment endpoint: Use the endpoint URL from Step 3
- IPA generation endpoint: Use the endpoint URL from Step 4

## Step 7: Monitor and Optimize

1. Monitor endpoint usage in RunPod Console
2. Adjust worker counts based on traffic
3. Monitor costs and optimize GPU selection
4. Review execution times and adjust timeouts if needed

## Troubleshooting

### Common Issues

1. **Image not found**: Ensure images are pushed to the correct registry
2. **Import errors**: Check that PYTHONPATH is set correctly in Dockerfile
3. **Timeout errors**: Increase execution timeout or optimize code
4. **GPU out of memory**: Use larger GPU or optimize model loading

### Debugging

- Check RunPod logs in the console
- Test locally with `docker run` to verify image works
- Check handler logs for Python errors

## Next Steps

After deployment is working:

1. **Replace dummy implementations**:
   - Implement actual POWSM model inference in `assessment/assess.py`
   - Implement actual POWSM G2P in `ipa_generation/generate.py`
   - Implement actual MFA alignment in `alignment/mfa.py`

2. **Optimize performance**:
   - Pre-load models in handler initialization
   - Cache model instances
   - Optimize audio preprocessing

3. **Add monitoring**:
   - Set up error tracking
   - Monitor API response times
   - Track usage metrics

