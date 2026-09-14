export function d1Adapter(db) {
  return {
    prepare(sql) {
      let args=[];
      return {
        bind(...values){args=values;return this;},
        async first(){return db.prepare(sql).get(...args)||null;},
        async run(){const r=db.prepare(sql).run(...args);return {success:true,meta:{changes:r.changes,last_row_id:r.lastInsertRowid}};},
        async all(){return {results:db.prepare(sql).all(...args),success:true};},
        async raw(){return db.prepare(sql).all(...args).map(row=>Object.values(row));},
      };
    },
    async batch(statements){db.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.all());db.exec('COMMIT');return results;}catch(error){db.exec('ROLLBACK');throw error;}},
  };
}
