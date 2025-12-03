# espnet/powsm · Hugging Face
🐁POWSM is the first phonetic foundation model that can perform four phone-related tasks: Phone Recognition (PR), Automatic Speech Recognition (ASR), audio-guided grapheme-to-phoneme conversion (G2P), and audio-guided phoneme-to-grapheme conversion (P2G).

Based on [Open Whisper-style Speech Model (OWSM)](https://www.wavlab.org/activities/2024/owsm/) and trained with [IPAPack++](https://huggingface.co/anyspeech), POWSM outperforms or matches specialized PR models of similar size while jointly supporting G2P, P2G, and ASR.

To use the pre-trained model, please install `espnet` and `espnet_model_zoo`. The requirements are:

```
torch
espnet
espnet_model_zoo

```


**The recipe can be found in ESPnet:** [https://github.com/espnet/espnet/tree/master/egs2/powsm/s2t1](https://github.com/espnet/espnet/tree/master/egs2/powsm/s2t1)

### [](#example-script-for-prasrg2pp2g)Example script for PR/ASR/G2P/P2G

Our models are trained on 16kHz audio with a fixed duration of 20s. When using the pre-trained model, please ensure the input speech is 16kHz and pad or truncate it to 20s.

To distinguish phone entries from BPE tokens that share the same Unicode, we enclose every phone in slashes and treat them as special tokens. For example, /pʰɔsəm/ would be tokenized as /pʰ//ɔ//s//ə//m/.

```
from espnet2.bin.s2t_inference import Speech2Text
import soundfile as sf  # or librosa

task = "<pr>"
s2t = Speech2Text.from_pretrained(
    "espnet/powsm",
    device="cuda",
    lang_sym="<eng>",   # ISO 639-3; set to <unk> for unseen languages
    task_sym=task,    # <pr>, <asr>, <g2p>, <p2g>
)

speech, rate = sf.read("sample.wav")
prompt = "<na>"         # G2P: set to ASR transcript; P2G: set to phone transcription with slashes
pred = s2t(speech, text_prev=prompt)
[0][0]

# post-processing for better format
pred = pred.split("<notimestamps>")
[1].strip()
if task == "<pr>" or task == "<g2p>":
  pred = pred.replace("/", "")
print(pred)

```


#### [](#other-tasks)Other tasks

See `force_align.py` in [ESPnet recipe](https://github.com/espnet/espnet/tree/master/egs2/powsm/s2t1) to try out CTC forced alignment with POWSM's encoder!

LID is learned implicitly during training, and you may run it with the script below:

```
from espnet2.bin.s2t_inference_language import Speech2Language
import soundfile as sf      # or librosa

s2t = Speech2Language.from_pretrained(
    "espnet/powsm",
    device="cuda",
    nbest=1,                # number of possible languages to return
    first_lang_sym="<afr>", # fixed; defined in vocab list
    last_lang_sym="<zul>"   # fixed; defined in vocab list
)

speech, rate = sf.read("sample.wav")
pred = model(speech)
[0]     # a list of lang-prob pair
print(pred)

```


### [](#citations)Citations

```
@article{powsm,
      title={POWSM: A Phonetic Open Whisper-Style Speech Foundation Model}, 
      author={Chin-Jou Li and Kalvin Chang and Shikhar Bharadwaj and Eunjung Yeo and Kwanghee Choi and Jian Zhu and David Mortensen and Shinji Watanabe},
      year={2025},
      eprint={2510.24992},
      archivePrefix={arXiv},
      primaryClass={cs.CL},
      url={https://arxiv.org/abs/2510.24992}, 
}

```
