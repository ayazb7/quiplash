import logging
import json
from azure.functions import HttpRequest, HttpResponse
from shared_code import cosmosdb_helper

def main(req: HttpRequest) -> HttpResponse:
    input_data = req.get_json()
    logging.info(f'Leaderboard request: {input_data}')

    limit = input_data['top']

    players = cosmosdb_helper.query_player_items(
            query='SELECT c.username, c.games_played, c.total_score FROM c ORDER BY c.total_score DESC, c.games_played ASC, c.username ASC',
            parameters=[]
        )

    top_players = players[:limit]

    return HttpResponse(
            body=json.dumps(top_players),
            mimetype="application/json"
        )


