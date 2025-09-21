/// <reference path="../pb_data/types.d.ts" />

migrate((db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("_pb_users_auth_");

  // Add full_name field
  collection.schema.addField(new SchemaField({
    "name": "full_name",
    "type": "text",
    "required": false,
    "presentable": true,
    "unique": false,
    "options": {
      "min": null,
      "max": 50,
      "pattern": ""
    }
  }));

  // Add bio field
  collection.schema.addField(new SchemaField({
    "name": "bio",
    "type": "text",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": null,
      "max": 250,
      "pattern": ""
    }
  }));

  // The 'verified' field is now built-in, so we don't need to add it.

  return dao.saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("_pb_users_auth_");

  // Remove fields in reverse order
  // The 'verified' field is built-in, so we don't remove it.
  collection.schema.removeField(collection.schema.getFieldByName("bio").id);
  collection.schema.removeField(collection.schema.getFieldByName("full_name").id);

  return dao.saveCollection(collection);
})
