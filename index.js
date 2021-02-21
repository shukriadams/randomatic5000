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
    substituteRegex = /{(.[^\/]*)}/,
    optionalRegex = /\/(.*)\//

function processTemplate(string){
    return string
        .split(' ')
        .map(word => processTemplateWord(word))
        .join(' ')
        .trim()
}

const processers = {
    doOptional(word){
        const matchCheck = word.match(optionalRegex)
    
        if (matchCheck){
            const inner = matchCheck.pop()
            word = word.replace(optionalRegex, chance.bool({ likelihood: baseLikelihood }) ? inner : '')
        }
    
        return word
    },
    
    doSubstitute(word){
        const matchCheck = word.match(substituteRegex)
    
        if (matchCheck){
            const setNames = matchCheck
                .pop()
                .split('|'),
                setName = sample(setNames),
                set = _settings.sets[setName]
            
            if (!set)
                throw `Set ${setName} doesnt exist`
    
            word = word.replace(substituteRegex, sample(set))
        }   
    
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
        if (nextFunction)
            word = processers[nextFunction](word)

        if (processed === word)
            break
        else
            processed = word
    }

    return word
}

function findBestNextDo(word){
    const checks = {
        doOptional : { regex : optionalRegex },
        doSubstitute : { regex : substituteRegex }
    }

    // find the length of enclosed text returned by each regex
    for (let check in checks){
        let match = word.match(checks[check].regex)
        checks[check].length = match ? match.pop().length : 0
    }

    // return the name of the pattern with the longest match
    let maxLength = 0,
        name = null

    for (let check in checks){
        if (checks[check].length && checks[check].length > maxLength){
            name = check
            maxLength = checks[check].length
        }
    }

    return name
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
                settings.sets[setName] = settings.sets[setName].split(',')

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