/// <reference path="../pb_data/types.d.ts" />

migrate((db) => {
  const collection = new Collection({
    "id": "comments",
    "created": "2024-05-20 12:03:00.000Z",
    "updated": "2024-05-20 12:03:00.000Z",
    "name": "comments",
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
        "name": "content",
        "type": "text",
        "required": true,
        "options": { "min": 1, "max": 500, "pattern": "" }
      },
      {
        "name": "parent_comment",
        "type": "relation",
        "required": false, // Nullable for top-level comments
        "options": {
          "collectionId": "comments",
          "cascadeDelete": true, // Delete replies if parent is deleted
          "minSelect": null,
          "maxSelect": 1,
          "displayFields": []
        }
      }
    ],
    "indexes": [],
    "listRule": "post.community = null || post.community.private = false || (post.community.private = true && @request.auth.id ~ post.community.members)",
    "viewRule": "post.community = null || post.community.private = false || (post.community.private = true && @request.auth.id ~ post.community.members)",
    "createRule": "@request.auth.id != '' && user = @request.auth.id",
    "updateRule": "user = @request.auth.id",
    "deleteRule": "user = @request.auth.id",
    "options": {}
  });

  return Dao(db).saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("comments");
  return dao.deleteCollection(collection);
})
