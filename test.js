const Randomtic = require('./index'),
    randomatic = new Randomtic({
        settings : './example.yml'
    })

console.log(randomatic.next())
