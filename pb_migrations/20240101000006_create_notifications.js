/// <reference path="../pb_data/types.d.ts" />

migrate((db) => {
  const collection = new Collection({
    "id": "notifications",
    "created": "2024-05-20 12:04:00.000Z",
    "updated": "2024-05-20 12:04:00.000Z",
    "name": "notifications",
    "type": "base",
    "system": false,
    "schema": [
      {
        "name": "user", // The recipient of the notification
        "type": "relation",
        "required": true,
        "options": {
          "collectionId": "_pb_users_auth_",
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
            "mention",
            "like",
            "comment",
            "repost",
            "follow",
            "community_join"
          ]
        }
      },
      {
        "name": "source_user",
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
        "required": false, // Nullable, e.g., for follow notifications
        "options": {
          "collectionId": "posts",
          "cascadeDelete": true,
          "minSelect": null,
          "maxSelect": 1,
          "displayFields": []
        }
      },
      {
        "name": "read",
        "type": "bool",
        "required": false,
        "options": {}
      }
    ],
    "indexes": [],
    "listRule": "user = @request.auth.id",
    "viewRule": "user = @request.auth.id",
    "createRule": null, // Only backend can create notifications
    "updateRule": "user = @request.auth.id", // User can mark as read
    "deleteRule": null,
    "options": {}
  });

  return Dao(db).saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("notifications");
  return dao.deleteCollection(collection);
})
