const sample = require('lodash.sample'),
    Chance = require('chance'),
    util = require('util'),
    chance = new Chance()
/*

- A "template" is an object derived from a string.
- Normally a string is split by " " to make up the template.
- In its simplest form we can say that some words in the string will be substituted against a list, while others will pass through unchanged.
  f.ex if we have a "food" list [apples, bbq] then the string "I ate the {food}" can produce "I ate the apples" or "I ate the bbq".
- We add complexity to the system by 
- making some substitutions optional
- allowing nesting templates, by allowing templates to act as sets
- making some nested templates self-repeating
- assigning modifiers to sets. these can be applied to a set when that set is used in a subtitutions
- modifiers can replace, prepend or postpend a word
*/

let _settings = {
    templates: {},
    sets: {}
}
const baseLikelihood = 50,
    // look for text enclosed in "{ }". Ignore text that contains "{" "\", "[" and "]", as these are wrappers
    // belong to other wrappers
    substituteRegex = /{(.[^{\/\[\]]*)}/,
    optionalRegex = /\/(.*)\//,
    // entirely enclosed in [ ]
    // group1 ([0-9]+) : required, integer, nr of times to repeat, must be present
    // group2 ([-]?[0-9]+)? : optional, creates range of group1 - group2, integers only
    // group3 {(.*)} : required. set to substitute
    // group4 (.*?) : optional, everything after set match to closing ]. delimiter
    repeatingSubstituteRegex = /\[([0-9]+)([-]?[0-9]+)?{(.*)}(.*?)\]/

function processTemplate(string){
    let words = [],
        sentence = string

    let i = 0
    while(sentence.length){
        const match = findBestNextDo(sentence)
        if (match){
            if (match.start > 0)
                words.push(sentence.substring(0, match.start))

            words.push(sentence.substring(match.start, match.reach))
            sentence = sentence.substring(match.reach + 1)

        } else {
            const nextSpace = sentence.indexOf(' ')
            if (nextSpace === -1){
                words.push(sentence)
                sentence = ''
            } else {
                words.push(0, sentence.substring(nextSpace))
                sentence = sentence.substring(nextSpace + 1)
            }
        }

        // runaway prevention
        i++
        if (i > 1000)break
    }

    let rendered = []
    for (let word of words)
        rendered.push(processTemplateWord(word))
    
    return rendered.join('').trim()
}

const processors = {
    doOptional(word){
        console.log('doOptional:input:', word)

        const matchCheck = word.match(optionalRegex),
            inner = matchCheck.pop()

        word = word.replace(optionalRegex, chance.bool({ likelihood: baseLikelihood }) ? inner : '')

        console.log('doOptional:ouput:', word)

        return word
    },

    doRepeatingSubstitute(word){
        console.log('doRepeatingSubstitute:input:', word)

        let matchCheck = word.match(repeatingSubstituteRegex),
            from = parseInt(matchCheck[1]),
            to = matchCheck[2],
            setNames = matchCheck[3].split('|'),
            delimiter = matchCheck[4] || ''

        if (!to){
            to = from
            from = 0
        } else {
            to = parseInt(to.replace('-', ''))
            to = chance.integer({min : from, max : to})
            from = 0
        }

        // console.log(matchCheck, from, to, setNames, delimiter)

        const subs = []
        for (let i = from ; i < to; i ++){
            const setName = sample(setNames),
                set = _settings.sets[setName]

            if (!set)
                throw `Set ${setName} doesnt exist`
            
            subs.push(sample(set))
        }

        word = subs.join(delimiter)

        console.log('doRepeatingSubstitute:ouput:', word)
        return word
    },

    doSubstitute(word){
        console.log('doSubstitute:input:', word)

        const matchCheck = word.match(substituteRegex),
            setNames = matchCheck
                .pop()
                .split('|'),
                setName = sample(setNames),
                set = _settings.sets[setName]
        
        if (!set)
            throw `Set ${setName} doesnt exist`

        word = word.replace(substituteRegex, `${sample(set)} `)
        
        console.log('doSubstitute:ouput:', word)

        return word
    }
}

function processTemplateWord(word){

    let processed,
        iterations = 0

    while(true){
        // do all steps here
        iterations ++
        if (iterations > 1000)
            throw `too many iterations processing "${word}" - is this a circular reference?`

        const nextFunction = findBestNextDo(word)
        if (nextFunction.function)
            word = processors[nextFunction.function](word)

        if (processed === word)
            break
        else
            processed = word
    }

    return word
}

function findBestNextDo(string){
    const checks = {
        // hash names must match function names in "processors" object
        doOptional : { regex : optionalRegex },
        doRepeatingSubstitute : {regex : repeatingSubstituteRegex },
        doSubstitute : { regex : substituteRegex }
    }

    // find the length of enclosed text returned by each regex
    for (let check in checks){
        let match = string.match(checks[check].regex)
        if (match){
            checks[check].length = match[0].length
            checks[check].start = string.indexOf(match[0])
            checks[check].reach = checks[check].start + match[0].length
        }
        
    }

    // return the name of the pattern with the longest match
    let maxLength = 0,
        name = null,
        start = 0,
        reach = 0

    for (let check in checks){
        if (checks[check].length && checks[check].length > maxLength){
            name = check
            maxLength = checks[check].length
            start = checks[check].start
            reach = checks[check].reach
        }
    }
    
    /*
    if (name)
        console.log('function > ', name, 'on', string)
    else
        console.log('passthrough >', string)
    */
    return { function : name, length : maxLength, start, reach }
}



function parseTemplate(template){
    const parsed = {
        raw: template,
        parts : []
    }

    if (typeof template !== 'string')
        throw `template ${template} should be a string`

    const parts = template.split(' ')

    for (const part of parts){
        const match = part.match(/{(.*)}/)

        if (match){
            const rawToken = match.pop()
            parsed.parts.push({
                part,
                rawToken,
                tokens : rawToken.split('|')
            })
        } else {
            parsed.parts.push({
                part
            })
        }
    }

    return parsed
}


module.exports = class {

    constructor(settings){

        
        // standardize settings
        for (const setName in settings.sets){
            let set = settings.sets[setName]
            // sets can be defined as comma-separated strings, but are expected to be arrays
            if (!Array.isArray(set) && typeof set !== `string`)
                throw `set "${setName}" must be an array or string`
        }


        // validate settings
        for (const templateName in settings.templates)
            if (typeof settings.templates[templateName] !== 'string')
                throw `templateName "${templateName}" must be a string`

        if (settings.templates.length === 0)
            throw `No templates defined, please add at least one`

        // sets cannot be empty
        for (const setName in settings.sets)
            if (!settings.sets[setName].length)
                throw `Set ${setName} is empty`
        
        // parse everything
        //for (const templateName in settings.templates)
        //    _settings.templates[templateName] = parseFirst(settings.templates[templateName])

        // convert set to arrays
        for (let setName in settings.sets)
            if (typeof settings.sets[setName] === 'string')
                settings.sets[setName] = settings.sets[setName].split(',').map(item => item.trim())

/*
        // ensure that sets defined in templates exist
        for (const templateRaw of settings.templates){
            const parsedTemplate = parseTemplate(templateRaw)
            for (let part of parsedTemplate.parts){
                if (!part.tokens)
                    continue

                for (const token of part.tokens)
                    if (!settings.sets[token])
                        throw `template "${templateRaw}" requires a set "${token}" that is not defined`
            }

            _parsed.push(parsedTemplate)
        }
*/
        _settings = Object.assign(_settings, settings)
        

        
    }

    next(){
        const template = sample(_settings.templates)
        
        // console.log(util.inspect(_parsedTemplates, { showHidden: false, depth: null }))
        let output = processTemplate(template)

        return { 
            template,
            result : output
        }
    }
}