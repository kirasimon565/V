/// <reference path="../pb_data/types.d.ts" />

migrate((db) => {
  const collection = new Collection({
    "id": "posts",
    "created": "2024-05-20 12:01:00.000Z",
    "updated": "2024-05-20 12:01:00.000Z",
    "name": "posts",
    "type": "base",
    "system": false,
    "schema": [
      {
        "name": "author",
        "type": "relation",
        "required": true,
        "options": {
          "collectionId": "_pb_users_auth_",
          "cascadeDelete": true, // Delete posts if author is deleted
          "minSelect": null,
          "maxSelect": 1,
          "displayFields": ["username", "full_name"]
        }
      },
      {
        "name": "content",
        "type": "text",
        "required": true,
        "options": { "min": 1, "max": 500, "pattern": "" }
      },
      {
        "name": "community",
        "type": "relation",
        "required": false, // Nullable
        "options": {
          "collectionId": "communities",
          "cascadeDelete": false,
          "minSelect": null,
          "maxSelect": 1,
          "displayFields": ["name"]
        }
      }
    ],
    "indexes": [],
    "listRule": "(@request.auth.id != '' && community = null) || (@request.auth.id != '' && community.private = false) || (@request.auth.id != '' && community.private = true && @request.auth.id ~ community.members)",
    "viewRule": "(@request.auth.id != '' && community = null) || (@request.auth.id != '' && community.private = false) || (@request.auth.id != '' && community.private = true && @request.auth.id ~ community.members)",
    "createRule": "@request.auth.id != '' && author = @request.auth.id",
    "updateRule": "author = @request.auth.id",
    "deleteRule": "author = @request.auth.id",
    "options": {}
  });

  return Dao(db).saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("posts");
  return dao.deleteCollection(collection);
})
