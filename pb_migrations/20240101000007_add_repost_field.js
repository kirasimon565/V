/// <reference path="../pb_data/types.d.ts" />

migrate((db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("posts");

  // Add original_post relation field
  collection.schema.addField(new SchemaField({
    "name": "original_post",
    "type": "relation",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "collectionId": "posts",
      "cascadeDelete": false, // Don't delete reposts if original is deleted
      "minSelect": null,
      "maxSelect": 1,
      "displayFields": null
    }
  }));

  return dao.saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("posts");

  collection.schema.removeField(collection.schema.getFieldByName("original_post").id);

  return dao.saveCollection(collection);
})
