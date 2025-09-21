/// <reference path="../pb_data/types.d.ts" />

migrate((db) => {
  const collection = new Collection({
    "id": "interactions",
    "created": "2024-05-20 12:02:00.000Z",
    "updated": "2024-05-20 12:02:00.000Z",
    "name": "interactions",
    "type": "base",
    "system": false,
    "schema": [
      {
        "name": "user",
        "type": "relation",
        "required": true,
        "options": {
          "collectionId": "_pb_users_auth_",
          "cascadeDelete": true,
          "minSelect": null,
          "maxSelect": 1,
          "displayFields": ["username"]
        }
      },
      {
        "name": "post",
        "type": "relation",
        "required": true,
        "options": {
          "collectionId": "posts",
          "cascadeDelete": true,
          "minSelect": null,
          "maxSelect": 1,
          "displayFields": []
        }
      },
      {
        "name": "type",
        "type": "select",
        "required": true,
        "options": {
          "maxSelect": 1,
          "values": [
            "like",
            "repost",
            "bookmark"
          ]
        }
      }
    ],
    "indexes": [
        // a user can only interact with a post once per type
        "CREATE UNIQUE INDEX `idx_interactions_user_post_type` ON `interactions` (`user`, `post`, `type`)"
    ],
    "listRule": "@request.auth.id != '' && user = @request.auth.id",
    "viewRule": "@request.auth.id != '' && post.author.id = @request.auth.id || @request.auth.id != '' && user = @request.auth.id",
    "createRule": "@request.auth.id != '' && user = @request.auth.id",
    "updateRule": "@request.auth.id != '' && user = @request.auth.id",
    "deleteRule": "@request.auth.id != '' && user = @request.auth.id",
    "options": {}
  });

  return Dao(db).saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("interactions");
  return dao.deleteCollection(collection);
})
