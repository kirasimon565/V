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

  // 'bio' and 'verified' are now assumed to be built-in.

  return dao.saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("_pb_users_auth_");

  // In the down migration, only remove the field we know we added.
  // This makes the down migration safer.
  try {
    const field = dao.findFieldByNameAndCollection("full_name", "_pb_users_auth_");
    collection.schema.removeField(field.id);
    return dao.saveCollection(collection);
  } catch (e) {
    // field doesn't exist
    return;
  }
})
