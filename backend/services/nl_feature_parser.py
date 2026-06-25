"""
NeuralForge — Natural Language Feature Parser (Production)
Uses LLM to extract structured feature values from natural language
descriptions. Validates against model feature schema.
"""

import logging
import json
from typing import Dict, Any, List, Optional

logger = logging.getLogger("neuralforge.nl_parser")


class NLFeatureParser:
    """
    Extracts structured feature values from natural language text
    using the model's feature schema as a guide.
    """

    @staticmethod
    async def parse(
        text: str,
        feature_schema: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Parse natural language text into structured feature values.

        Args:
            text: Natural language description (e.g., "35 year old male earning 50000")
            feature_schema: List of feature descriptors with name, type, min, max, options

        Returns:
            Dict with extracted_features, confidence_scores, validation_errors, unmapped
        """
        try:
            from services.llm_service import get_best_available_llm
            llm = get_best_available_llm(temperature=0.1)
        except Exception as e:
            logger.error("LLM not available for NL parsing: %s", e)
            return {
                "raw_text": text,
                "extracted_features": {},
                "confidence_scores": {},
                "validation_errors": ["LLM not available for feature extraction"],
                "unmapped": [],
            }

        # Build schema description for LLM
        schema_desc = []
        for feat in feature_schema:
            name = feat.get("name", "")
            ftype = feat.get("type", "unknown")
            desc = f"- {name} ({ftype})"
            if ftype == "numeric":
                min_val = feat.get("min", feat.get("stats", {}).get("min", ""))
                max_val = feat.get("max", feat.get("stats", {}).get("max", ""))
                default = feat.get("default_value", "")
                if min_val != "" or max_val != "":
                    desc += f" [range: {min_val} to {max_val}]"
                if default != "" and default is not None:
                    desc += f" [default: {default}]"
            elif feat.get("options"):
                opts = feat["options"][:10]  # Limit to 10 options
                desc += f" [options: {', '.join(str(o) for o in opts)}]"
            schema_desc.append(desc)

        prompt = f"""You are a precise feature extraction engine. Given natural language text and a feature schema, extract the feature values.

Feature Schema:
{chr(10).join(schema_desc)}

User Input (Natural Language):
"{text}"

RULES:
1. Extract ONLY features that are mentioned or can be inferred from the text.
2. For numeric features, convert text to numbers (e.g., "fifty thousand" → 50000, "12 lakh" → 1200000).
3. For categorical features, map to the closest available option.
4. If a feature cannot be determined from the text, DO NOT include it.
5. Provide a confidence score (0-100) for each extracted feature.

Return ONLY a JSON object with:
- "extracted_features": dict of feature_name → value
- "confidence_scores": dict of feature_name → confidence (0-100)
- "unmapped_text": list of text fragments that couldn't be mapped to any feature

Return ONLY the JSON object, no explanation."""

        try:
            response = llm.invoke(prompt)
            content = response.content if hasattr(response, "content") else str(response)

            content = content.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[1].rsplit("```", 1)[0]
            if content.startswith("json"):
                content = content[4:].strip()

            parsed = json.loads(content)

            extracted = parsed.get("extracted_features", {})
            confidence = parsed.get("confidence_scores", {})
            unmapped = parsed.get("unmapped_text", [])

            # Validate extracted values against schema
            validation_errors = []
            validated_features = {}

            for feat in feature_schema:
                name = feat.get("name", "")
                if name not in extracted:
                    continue

                value = extracted[name]
                ftype = feat.get("type", "unknown")

                if ftype == "numeric":
                    try:
                        num_val = float(value)
                        min_val = feat.get("min", feat.get("stats", {}).get("min"))
                        max_val = feat.get("max", feat.get("stats", {}).get("max"))

                        if min_val is not None and num_val < float(min_val):
                            validation_errors.append(
                                f"{name}: value {num_val} below minimum {min_val}"
                            )
                        if max_val is not None and num_val > float(max_val):
                            validation_errors.append(
                                f"{name}: value {num_val} above maximum {max_val}"
                            )

                        validated_features[name] = num_val
                    except (ValueError, TypeError):
                        validation_errors.append(
                            f"{name}: could not convert '{value}' to number"
                        )

                elif feat.get("options"):
                    options = [str(o) for o in feat["options"]]
                    str_val = str(value)
                    if str_val in options:
                        validated_features[name] = str_val
                    else:
                        # Try case-insensitive match
                        lower_map = {o.lower(): o for o in options}
                        if str_val.lower() in lower_map:
                            validated_features[name] = lower_map[str_val.lower()]
                        else:
                            validated_features[name] = str_val
                            validation_errors.append(
                                f"{name}: '{str_val}' not in known options "
                                f"({', '.join(options[:5])})"
                            )
                else:
                    validated_features[name] = value

            return {
                "raw_text": text,
                "extracted_features": validated_features,
                "confidence_scores": {
                    k: v for k, v in confidence.items() if k in validated_features
                },
                "validation_errors": validation_errors,
                "unmapped": unmapped,
            }

        except json.JSONDecodeError as e:
            logger.error("Failed to parse LLM response as JSON: %s", e)
            return {
                "raw_text": text,
                "extracted_features": {},
                "confidence_scores": {},
                "validation_errors": [f"JSON parse error: {str(e)}"],
                "unmapped": [text],
            }
        except Exception as e:
            logger.error("NL feature parsing failed: %s", e)
            return {
                "raw_text": text,
                "extracted_features": {},
                "confidence_scores": {},
                "validation_errors": [str(e)],
                "unmapped": [text],
            }


nl_feature_parser = NLFeatureParser()
