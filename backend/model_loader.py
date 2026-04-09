import os
from typing import Dict, List

import torch
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    DistilBertConfig,
    DistilBertForSequenceClassification,
    DistilBertTokenizerFast,
)

from utils import clean_text


MODEL_NAME = os.getenv("MODEL_NAME", "distilbert-base-uncased")
MAX_LENGTH = 128
LABELS = ["World", "Sports", "Business", "Sci/Tech"]
FALLBACK_TOKENIZER_DIR = os.path.join(
    os.path.dirname(__file__), "local_tokenizer"
)


BOOTSTRAP_SAMPLES = [
    ("Diplomats resumed negotiations after border tensions escalated during the week.", 0),
    ("The president addressed global leaders during the climate summit in Europe.", 0),
    ("Peace talks continued as the foreign ministers met to discuss sanctions.", 0),
    ("Thousands were evacuated after an earthquake struck the coastal region overnight.", 0),
    ("The striker scored twice as the home team advanced to the finals.", 1),
    ("The coach praised the defense after the club secured a dramatic victory.", 1),
    ("Olympic qualifiers begin next month following a record-breaking season.", 1),
    ("Fans celebrated the championship win after a tense overtime finish.", 1),
    ("Shares rose after the retailer posted strong quarterly earnings.", 2),
    ("The startup raised fresh capital to expand its logistics platform.", 2),
    ("Oil prices dipped as investors reacted to softer economic forecasts.", 2),
    ("The company announced layoffs and a restructuring plan to protect margins.", 2),
    ("Researchers launched a new AI system for low-power mobile devices.", 3),
    ("Scientists published findings about a reusable satellite propulsion method.", 3),
    ("The software update improves cybersecurity protections for cloud services.", 3),
    ("A robotics lab revealed autonomous navigation breakthroughs for drones.", 3),
]


class DistilBertNewsClassifier:
    def __init__(self) -> None:
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model_source = "pretrained"
        self.tokenizer, self.model = self._load_assets()
        self.model.to(self.device)
        self.model.eval()
        self._bootstrap_head()

    def _load_assets(self):
        try:
            tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
            model = AutoModelForSequenceClassification.from_pretrained(
                MODEL_NAME,
                num_labels=len(LABELS),
                ignore_mismatched_sizes=True,
            )
            return tokenizer, model
        except Exception:
            self.model_source = "local-fallback"
            tokenizer = DistilBertTokenizerFast.from_pretrained(FALLBACK_TOKENIZER_DIR)
            config = DistilBertConfig(
                vocab_size=tokenizer.vocab_size,
                max_position_embeddings=512,
                sinusoidal_pos_embds=False,
                n_layers=2,
                dim=128,
                hidden_dim=256,
                n_heads=4,
                dropout=0.1,
                attention_dropout=0.1,
                num_labels=len(LABELS),
            )
            model = DistilBertForSequenceClassification(config)
            return tokenizer, model

    def _bootstrap_head(self) -> None:
        # A tiny warm-start over curated examples gives the randomly initialized
        # classifier head usable separation without requiring a saved model file.
        for parameter in self.model.distilbert.parameters():
            parameter.requires_grad = False

        optimizer = torch.optim.AdamW(self.model.parameters(), lr=3e-5)
        self.model.train()

        training_texts = [clean_text(text) for text, _ in BOOTSTRAP_SAMPLES]
        training_labels = torch.tensor(
            [label for _, label in BOOTSTRAP_SAMPLES], dtype=torch.long
        ).to(self.device)

        encodings = self.tokenizer(
            training_texts,
            truncation=True,
            padding=True,
            max_length=MAX_LENGTH,
            return_tensors="pt",
        )
        encodings = {key: value.to(self.device) for key, value in encodings.items()}

        for _ in range(4):
            optimizer.zero_grad()
            outputs = self.model(**encodings, labels=training_labels)
            outputs.loss.backward()
            optimizer.step()

        self.model.eval()

    @torch.inference_mode()
    def predict(self, text: str) -> Dict[str, object]:
        cleaned_text = clean_text(text)
        encoded = self.tokenizer(
            cleaned_text,
            truncation=True,
            padding=True,
            max_length=MAX_LENGTH,
            return_tensors="pt",
        )
        encoded = {key: value.to(self.device) for key, value in encoded.items()}
        outputs = self.model(**encoded)
        probabilities = torch.softmax(outputs.logits, dim=-1)[0].detach().cpu()
        predicted_index = int(torch.argmax(probabilities).item())
        probabilities_list = [round(float(value), 4) for value in probabilities.tolist()]
        class_probabilities: List[Dict[str, float]] = [
            {"label": label, "probability": round(float(probabilities[index].item()), 4)}
            for index, label in enumerate(LABELS)
        ]

        return {
            "label": LABELS[predicted_index],
            "confidence": round(float(probabilities[predicted_index].item()), 4),
            "probabilities": probabilities_list,
            "class_probabilities": class_probabilities,
            "cleaned_text": cleaned_text,
            "model_source": self.model_source,
        }
