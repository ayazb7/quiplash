import logging
import json

from azure.functions import HttpRequest, HttpResponse
from azure.cosmos.exceptions import CosmosHttpResponseError
from shared_code import cosmosdb_helper

def main(req: HttpRequest) -> HttpResponse:
    input_data = req.get_json()
    logging.info('Registering user: {}'.format(input_data))

    username = input_data["username"]
    password = input_data["password"]

    if not (4 <= len(username) <= 14):
        return HttpResponse(json.dumps({"result": False, "msg": "Username less than 4 characters or more than 14 characters"}),mimetype="application/json")

    if not (10 <= len(password) <= 20):
        return HttpResponse(json.dumps({"result": False, "msg": "Password less than 10 characters or more than 20 characters"}),mimetype="application/json")

    try:
        player_exists = cosmosdb_helper.check_player_exists(username)

        if  player_exists:
            return HttpResponse(json.dumps({"result": False, "msg": "Username already exists"}),mimetype="application/json")
        else:
            user_data = {
                "username": username,
                "password": password,
                "games_played": 0,
                "total_score": 0
            }
            cosmosdb_helper.create_player_item(user_data)
            return HttpResponse(json.dumps({"result": True, "msg": "OK"}),mimetype="application/json")

    except CosmosHttpResponseError as e:
        logging.error(f"Error interacting with CosmosDB: {e}")
        return HttpResponse(json.dumps({"result": False, "msg": "Internal Server Error"}),mimetype="application/json")

