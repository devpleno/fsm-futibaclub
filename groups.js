const express = require('express')
const app = express.Router()

const init = connection => {
    app.use((req, res, next) => {
        if (!req.session.user) {
            res.redirect('/')
        } else {
            next()
        }
    })
    app.get('/', async (req, res) => {
        const [groups, fields] = await connection.execute(`
            select 
                groups.*, 
                groups_users.role 
            from groups 
            left join 
                groups_users on 
                    groups.id = groups_users.group_id 
                    and groups_users.user_id = ?
        `, [
            req.session.user.id
        ])
        res.render('groups', {
            groups
        })
    })
    app.get('/:id/pending/:idGU/:op', async (req, res) => {
        const [group] = await connection.execute(`
            select * 
                from groups 
            left join 
                groups_users on 
                    groups_users.group_id = groups.id 
                    and groups_users.user_id = ? 
                where groups.id = ?
        `, [
            req.session.user.id,
            req.params.id
        ])
        if (group.length == 0 || group[0].role !== 'owner') {
            res.redirect('/groups/' + req.params.id)
        } else {
            if (req.params.op === 'yes') {
                await connection.execute(`
                    update 
                    groups_users set 
                            role = "user" 
                        where id = ? 
                        limit 1
                `, [
                    req.params.idGU
                ])
                res.redirect('/groups/' + req.params.id)
            } else {
                await connection.execute(`
                    delete 
                    from groups_users 
                    where id = ? 
                    limit 1
                `, [
                    req.params.idGU
                ])
                res.redirect('/groups/' + req.params.id)
            }
        }
    })
    app.get('/:id', async (req, res) => {
        const [group] = await connection.execute(`
            select 
                groups.*, 
                groups_users.role 
            from groups 
                left join 
                    groups_users on 
                        groups_users.group_id = groups.id 
                        and groups_users.user_id = ? 
            where groups.id = ?
        `, [
            req.session.user.id,
            req.params.id
        ])
        const [pendings] = await connection.execute(`
            select 
                groups_users.*,
                users.name 
            from groups_users 
            inner join 
                users on 
                    groups_users.user_id = users.id 
                    and groups_users.group_id = ? 
                    and groups_users.role 
            like "pending"
        `, [
            req.params.id
        ])
        const [games] = await connection.execute(`
            select 
                games.*, 
                guessings.result_a as guess_a, 
                guessings.result_b as guess_b,
                guessings.score
            from games 
            left join 
                guessings 
                    on games.id = guessings.game_id 
                        and guessings.user_id = ? 
                        and guessings.group_id = ?`
            , [
                req.session.user.id,
                req.params.id
            ])
        res.render('group', {
            pendings,
            group: group[0],
            games
        })
    })
    app.post('/:id', async (req, res) => {
        const guessings = []
        Object
            .keys(req.body)
            .forEach(team => {
                const parts = team.split('_')
                const game = {
                    game_id: parts[1],
                    result_a: req.body[team].a,
                    result_b: req.body[team].b
                }
                guessings.push(game)
            })
        const batch = guessings.map(guess => {
            return connection.execute(`
                insert into 
                    guessings 
                        (result_a,result_b,game_id, group_id, user_id)
                    values 
                        (?,?,?,?,?)
            `, [
                guess.result_a,
                guess.result_b,
                guess.game_id,
                req.params.id,
                req.session.user.id
            ])
        })
        await Promise.all(batch)
        res.redirect('/groups/' + req.params.id)
    })
    app.get('/:id/join', async (req, res) => {
        const [rows, fields] = await connection.execute(`
            select * from 
                groups_users 
            where 
                user_id = ? 
                and group_id = ?
        `, [
            req.session.user.id,
            req.params.id
        ])
        if (rows.length > 0) {
            res.redirect('/groups')
        } else {
            await connection.execute(`
                insert into 
                    groups_users 
                        (group_id, user_id, role) 
                    values 
                        (?,?,?)
            `, [
                req.params.id,
                req.session.user.id,
                'pending'
            ])
            res.redirect('/groups')
        }
    })
    app.post('/', async (req, res) => {
        const [insertedId, insertedFields] = await connection.execute('insert into groups (name) values (?)', [
            req.body.name
        ])
        await connection.execute(`
            insert into 
                groups_users 
                    (group_id, user_id, role) 
                values 
                    (?,?,?)
        `, [
            insertedId.insertId,
            req.session.user.id,
            'owner'
        ])
        res.redirect('/groups')
    })
    return app
}

module.exports = init