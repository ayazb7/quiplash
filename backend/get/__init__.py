import logging
import json

from azure.functions import HttpRequest, HttpResponse
from shared_code import cosmosdb_helper

def main(req: HttpRequest) -> HttpResponse:
    input_data = req.get_json()
    logging.info(f'Util get request: {input_data}')

    players = input_data['players']
    language = input_data['language']

    prompts = []
    for username in players:
        user_prompts = cosmosdb_helper.query_prompt_items(
            query="SELECT * FROM c WHERE c.username = @username",
            parameters=[{"name": "@username", "value": username}]
        )

        for prompt in user_prompts:
            for text in prompt['texts']:
                if text['language'] == language:
                    prompts.append({
                        "id": prompt['id'],
                        "text": text['text'],
                        "username": prompt['username']
                    })

    return HttpResponse(
        json.dumps(prompts),
        mimetype="application/json"
    )
