const express = require('express')
const app = express.Router()

const init = connection => {
    app.get('/', async (req, res) => {
        const query = `
        select
            users.id, 
            users.name,
            sum(guessings.score) as score
        from users
        left join
            guessings
                on guessings.user_id = users.id
        group by users.id
        order by score DESC
        LIMIT 3`
        const [rows] = await connection.execute(query)
        classification = rows
        res.render('home', { ranking: rows })
    })

    app.get('/logout', (req, res) => {
        req.session.destroy(err => {
            res.redirect('/')
        })
    })

    app.get('/login', (req, res) => {
        res.render('login', { error: false })
    })

    app.post('/login', async (req, res) => {
        const [rows, fields] = await connection.execute('select * from users where email = ?', [req.body.email])
        if (rows.length === 0) {
            res.render('login', { error: 'Usuário e/ou Senha inválidos.' })
        } else {
            if (rows[0].passwd === req.body.passwd) {
                const userDb = rows[0]
                const user = {
                    id: userDb.id,
                    name: userDb.name,
                    role: userDb.role
                }
                req.session.user = user
                res.redirect('/')
            } else {
                res.render('login', { error: 'Usuário e/ou senha inválidos.' })
            }
        }
    })

    app.get('/new-account', (req, res) => {
        res.render('new-account', { error: false })
    })

    app.post('/new-account', async (req, res) => {
        const [rows, fields] = await connection.execute('select * from users where email = ?', [req.body.email])
        if (rows.length === 0) {
            const { name, email, passwd } = req.body
            const [inserted, insertedFields] = await connection.execute('insert into users (name, email, passwd, role) values(?,?,?,?)', [
                name, email, passwd, 'user'
            ])
            const user = {
                id: inserted.insertId,
                name: name,
                role: 'user'
            }
            req.session.user = user
            res.redirect('/')
        } else {
            res.render('new-account', {
                error: 'Usuário Já Existente'
            })
        }
    })

    return app
}

module.exports = init