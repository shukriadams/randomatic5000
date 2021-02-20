const Randomtic = require('./index'),
    randomatic = new Randomtic({
        settings : './example.yml'
    })

for (let i = 0; i < 1 ; i ++)
    console.log(randomatic.next())
