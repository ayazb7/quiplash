import logging
import json
from azure.functions import HttpRequest, HttpResponse
from shared_code import cosmosdb_helper

def main(req: HttpRequest) -> HttpResponse:
    input_data = req.get_json()
    logging.info(f'Delete prompt request: {input_data}')

    if "player" in input_data:
        username = input_data["player"]
        prompts = cosmosdb_helper.query_prompt_items(
            query='SELECT * FROM c WHERE c.username = @username',
            parameters=[{"name": "@username", "value": username}]
        )
        deleted_count = 0
        for prompt in prompts:
            cosmosdb_helper.delete_prompt_item(prompt['id'], prompt['username'])
            deleted_count += 1
        return HttpResponse(json.dumps({"result": True, "msg": f"{deleted_count} prompts deleted"}), mimetype="application/json")
    
    elif "word" in input_data:
        word = input_data["word"]
        logging.info(f'Deleting prompts with word: {word}')
        prompts = cosmosdb_helper.query_prompt_items(
            query="SELECT * FROM c WHERE ARRAY_CONTAINS(c.texts, {'language': 'en'}, true)",
            parameters=[],
            enable_cross_partition_query=True
        )
        deleted_count = 0
        for prompt in prompts:
            texts = prompt['texts']
            if any(word in text['text'].split() for text in prompt['texts'] if text['language'] == 'en'):
                cosmosdb_helper.delete_prompt_item(prompt['id'], prompt['username'])
                deleted_count += 1
        return HttpResponse(json.dumps({"result": True, "msg": f"{deleted_count} prompts deleted"}), mimetype="application/json")
    
    else:
        return HttpResponse(json.dumps({"result": False, "msg": "Invalid input"}), mimetype="application/json")
