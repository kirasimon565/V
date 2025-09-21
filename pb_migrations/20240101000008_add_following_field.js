/// <reference path="../pb_data/types.d.ts" />

migrate((db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("_pb_users_auth_");

  // Add 'following' field
  collection.schema.addField(new SchemaField({
    "name": "following",
    "type": "relation",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "collectionId": "_pb_users_auth_", // Self-relation
      "cascadeDelete": false,
      "minSelect": null,
      "maxSelect": null, // Can follow multiple users
      "displayFields": null
    }
  }));

  return dao.saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("_pb_users_auth_");

  collection.schema.removeField(collection.schema.getFieldByName("following").id);

  return dao.saveCollection(collection);
})
