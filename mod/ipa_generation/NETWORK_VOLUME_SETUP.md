# Network Volume Setup for RunPod Serverless

This guide explains how to set up and use network volumes with your RunPod Serverless endpoints to cache model weights and avoid re-downloading them on every cold start.

## Benefits

- **Faster cold starts**: Models are cached on persistent storage, so workers don't need to download them
- **Cost efficiency**: Avoids repeated downloads of large model files
- **Shared cache**: All workers on the endpoint share the same cached models

## Setup Steps

### 1. Create Network Volume (if not already done)

1. Navigate to [Storage page](https://www.console.runpod.io/user/storage) in RunPod console
2. Click **New Network Volume**
3. Select a datacenter (choose one close to your endpoint or where you have GPUs)
4. Provide a name (e.g., "nounce-shared")
5. Specify size in GB (recommend at least 20GB for POWSM models)
6. Click **Create Network Volume**

**Note:** Your volume name is `nounce-shared`. The volume name doesn't affect the mount path - RunPod always mounts network volumes at `/runpod-volume` regardless of the name.

### 2. Attach Network Volume to Endpoint

1. Navigate to [Serverless Endpoints](https://www.console.runpod.io/serverless/user/endpoints)
2. Select your endpoint and click **Manage** → **Edit Endpoint**
3. Scroll down to **Advanced** section
4. Click **Network Volume** dropdown
5. Select **nounce-shared** (or your volume name)
6. Click **Save Endpoint**

### 3. How It Works

Once attached, the network volume is automatically mounted at `/runpod-volume` in all workers.

The Dockerfile sets `HF_HOME=/runpod-volume/.cache/huggingface` as an environment variable:
- When the volume is attached, HuggingFace/ESPnet will cache models in this location
- Subsequent workers will use the cached models instead of downloading
- If the volume isn't attached, HuggingFace falls back to default cache location

### 4. First Run

On the **first request** after attaching the volume:
- The model will be downloaded to `/runpod-volume/.cache/huggingface`
- This may take a few minutes (one-time cost)
- Subsequent requests will use the cached model (much faster)

### 5. Verify It's Working

Check the logs to see if models are being cached. On first run, you'll see model downloads. On subsequent runs, models should load from cache (much faster).

To verify the volume is mounted, you can check if `/runpod-volume` exists in your worker (though this requires accessing the worker directly, which isn't always possible in Serverless).

The easiest way to verify is by timing: if cold starts are much faster after the first request, the cache is working.

## Important Notes

⚠️ **Data Center Constraint**: When using network volumes, your endpoint is constrained to the datacenter where the volume is located. This may impact GPU availability.

⚠️ **Concurrent Access**: Multiple workers can read from the same volume simultaneously, but avoid writing to the same files at the same time.

💰 **Cost**: Network volumes cost $0.07/GB/month for first 1TB, $0.05/GB/month for additional storage.

## Pre-populating the Cache (Optional)

You can pre-populate the cache using a Pod:

1. Deploy a Pod with the network volume attached
2. In the Pod, run:
   ```python
   from espnet2.bin.s2t_inference import Speech2Text
   import os
   
   # Set cache to network volume
   os.environ["HF_HOME"] = "/workspace/.cache/huggingface"
   os.makedirs("/workspace/.cache/huggingface", exist_ok=True)
   
   # Download model (will be cached)
   model = Speech2Text.from_pretrained(
       "espnet/powsm",
       device="cpu",
       lang_sym="<eng>",
       task_sym="<g2p>",
   )
   ```
3. The model will be cached in the network volume
4. Your Serverless workers will then use the cached model immediately

## Troubleshooting

**Models still downloading every time?**
- Check that network volume is attached in endpoint settings
- Verify `/runpod-volume` exists in worker logs
- Check that `HF_HOME` is set correctly in logs

**Volume not mounting?**
- Ensure volume and endpoint are in the same datacenter
- Check endpoint settings to confirm volume is selected
- Restart the endpoint after attaching volume

