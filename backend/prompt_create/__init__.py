import logging
import json
import requests

from azure.functions import HttpRequest, HttpResponse
import os
from shared_code import cosmosdb_helper

language_codes = ["en", "es", "it", "sv", "ru", "id", "bg", "zh-Hans"]

def main(req: HttpRequest) -> HttpResponse:
    input_data = req.get_json()
    logging.info(f"Creating prompt: {input_data}")

    text = input_data["text"]
    username = input_data["username"]

    if not (15 <= len(text) <= 80):
        return HttpResponse(json.dumps({"result": False, "msg": "Prompt less than 15 characters or more than 80 characters"}), mimetype="application/json")

    if not cosmosdb_helper.check_player_exists(username):
        return HttpResponse(json.dumps({"result": False, "msg": "Player does not exist"}), mimetype="application/json")

    headers = {
        'Ocp-Apim-Subscription-Key': os.environ['TranslationKey'],
        'Ocp-Apim-Subscription-Region': 'uksouth',
        'Content-type': 'application/json'
    }
    body = [{"text": text}]

    lang_url_codes = ""
    for code in language_codes[:-1]:
        lang_url_codes += (code + "&to=")
    lang_url_codes += language_codes[-1] 

    translate_response = requests.post(os.environ['TranslationEndpoint'] + "/translate?api-version=3.0&to=" + lang_url_codes, headers=headers, json=body).json()

    detected_language = translate_response[0]['detectedLanguage']['language']
    language_confidence = translate_response[0]['detectedLanguage']['score']

    logging.info(f'Translate response: {translate_response}')

    if detected_language not in language_codes or language_confidence < 0.3:
        return HttpResponse(json.dumps({"result": False, "msg": "Unsupported language"}), mimetype="application/json")

    translated_texts = [{"language": detected_language, "text": text}]

    for translation in translate_response[0]['translations']:
        if translation['to'] != detected_language:
            translated_texts.append({
                "language": translation['to'],
                "text": translation['text']
            })

    prompt_data = {
        "username": username,
        "texts": translated_texts
    }
    try:
        cosmosdb_helper.create_prompt_item(prompt_data, enable_automatic_id_generation=True)
        return HttpResponse(json.dumps({"result": True, "msg": "OK"}), mimetype="application/json")
    except Exception as e:
        logging.error(f"Error interacting with CosmosDB: {e}")
        return HttpResponse(json.dumps({"result": False, "msg": "Internal Server Error"}), mimetype="application/json")
