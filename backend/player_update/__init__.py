import logging
import json

from azure.functions import HttpRequest, HttpResponse
from azure.cosmos.exceptions import CosmosHttpResponseError
from shared_code import cosmosdb_helper

def main(req: HttpRequest) -> HttpResponse:
    input_data = req.get_json()
    logging.info('Updating user: {}'.format(input_data))

    username = input_data["username"]

    try:
        items = cosmosdb_helper.get_player_data(username)
        
        if items:
            player_item = items[0]

            gamesToAdd = input_data["add_to_games_played"]
            scoreToAdd = input_data["add_to_score"]
            
            player_item["games_played"] += gamesToAdd
            player_item["total_score"] += scoreToAdd

            cosmosdb_helper.replace_player_item(player_item, player_item)

            return HttpResponse(json.dumps({"result": True, "msg": "OK"}), mimetype="application/json")
        else:
            return HttpResponse(json.dumps({"result": False, "msg": "Player does not exist" }), mimetype="application/json")
            
    except CosmosHttpResponseError as e:
        logging.error(f"Error interacting with CosmosDB: {e}")
        return HttpResponse(json.dumps({"result": False, "msg": "Internal Server Error"}), mimetype="application/json")


