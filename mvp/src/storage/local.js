const {pool} = require('../db');

async function uploadPdf({key, buffer, contentType}){
    const query = `
    INSERT INTO files(key, data, content_type) 
    VALUES ($1, $2, $3)
    ON CONFLICT(key)
    DO UPDATE SET 
        data = EXCLUDED.data, 
        content_type = EXCLUDED.content_type
    RETURNING key;
    `;
    const values = [key, buffer, contentType];
    const result = await pool.query(query, values);
    return result.rows[0];
}

async function getObject({key}){
    const query = `
    SELECT data, content_type
    FROM files 
    WHERE key = $1
    `;
    
    const result = await pool.query(query, [key]);

    if(result.rows.length === 0){
        throw new Error('FILE NOT FOUND CUH');
    }

    return result.rows[0];
}

module.exports = { uploadPdf, getObject };