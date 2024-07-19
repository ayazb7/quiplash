import logging
import json
from azure.functions import HttpRequest, HttpResponse
from azure.cosmos.exceptions import CosmosHttpResponseError
from shared_code import cosmosdb_helper

def main(req: HttpRequest) -> HttpResponse:
    input_data = req.get_json()
    logging.info('Logging in user: {}'.format(input_data))

    username = input_data["username"]
    password = input_data["password"]

    try:
        items = cosmosdb_helper.get_player_data(username)

        if items and items[0]['password'] == password:
            return HttpResponse(json.dumps({"result": True, "msg": "OK"}), mimetype="application/json")
        else:
            return HttpResponse(json.dumps({"result": False, "msg": "Username or password incorrect"}), mimetype="application/json")
            
    except CosmosHttpResponseError as e:
        logging.error(f"Error interacting with CosmosDB: {e}")
        return HttpResponse(json.dumps({"result": False, "msg": "Internal Server Error"}), mimetype="application/json")
