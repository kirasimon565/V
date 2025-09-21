/// <reference path="../pb_data/types.d.ts" />

migrate((db) => {
  const collection = new Collection({
    "id": "communities",
    "created": "2024-05-20 12:00:00.000Z",
    "updated": "2024-05-20 12:00:00.000Z",
    "name": "communities",
    "type": "base",
    "system": false,
    "schema": [
      {
        "name": "name",
        "type": "text",
        "required": true,
        "unique": true,
        "options": { "min": 2, "max": 50, "pattern": "" }
      },
      {
        "name": "description",
        "type": "text",
        "required": false,
        "options": { "min": 0, "max": 250, "pattern": "" }
      },
      {
        "name": "rules",
        "type": "editor", // Using 'editor' for Markdown-like text
        "required": false,
        "options": {}
      },
      {
        "name": "members",
        "type": "relation",
        "required": false,
        "options": {
          "collectionId": "_pb_users_auth_",
          "cascadeDelete": false,
          "minSelect": null,
          "maxSelect": null, // Multiple members
          "displayFields": ["username", "full_name"]
        }
      },
      {
        "name": "private",
        "type": "bool",
        "required": false,
        "options": {}
      }
    ],
    "indexes": [
      "CREATE UNIQUE INDEX `idx_communities_name` ON `communities` (`name`)"
    ],
    "listRule": "(@request.auth.id != '' && private = false) || (@request.auth.id != '' && private = true && @request.auth.id ~ members)",
    "viewRule": "(@request.auth.id != '' && private = false) || (@request.auth.id != '' && private = true && @request.auth.id ~ members)",
    "createRule": "@request.auth.id != ''",
    "updateRule": "@request.auth.id != ''", // Should be admin/owner only, will refine later
    "deleteRule": null, // Only admins should delete
    "options": {}
  });

  return Dao(db).saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("communities");
  return dao.deleteCollection(collection);
})
