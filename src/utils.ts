
let fs

export const isNode = () => typeof window === 'undefined'


// @ts-ignore
if (isNode()) {
  // @ts-ignore
  fs = require('fs')
}

const getNotionContent = (type: string, value: any) => {
  
  // console.log({ type, value })
  return type === 'rich_text' && Array.isArray(value) ? JSON.stringify(value) : value
}

// TODO : handle better Type recognition
const getNotionType = (value: any) => {

  let type: string[] | string = Object.prototype.toString.call(value).split(' ')
  type = type[1].slice(0, type[1].length - 1).toLowerCase()
  
  if (type === 'object') {
    type = value.constructor.name
    console.log('Error: not supposed to be a object here :', { value, type })
    if (type === 'Collection') {
      console.log('Error: not supposed to be a Collection here :', { value, type })
      type = value[0].constructor.name + '[]'
    }
  }
  
  if (type === 'string' && value.match(/\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)/)) {
    return 'date'
  }
  else if (type === 'number') {
    return 'number'
  }
  else if (type === 'boolean') {
    return 'boolean'  
  }
  else {
    return 'rich_text'
  }
}

export const getNotionObject = (value: any, isPrimaryKey: boolean) => {
  const type = isPrimaryKey ? 'title' : getNotionType(value)
  
  const content = getNotionContent(type, value)
  
  if (type === 'date') {
    return {
      type: 'date',
      date: {
        start: content
      }
    }
  }
  else if (type === 'number') {
    return {
      type: 'number',
      number: content
    }
  }
  else if (type === 'boolean') {
    return {
      type: 'checkbox',
      checkbox: content
    }
  } else {
    return {
      type,
      [type]: [
        {
          type: 'text',
          text: {
            content,
          },
        },
      ],
    }
  }
}

// TODO : might not need entityName
export const getNotionData = (data: any, primaryKey: string) => {
  const notionData = {}
    
  Object.entries(data).map(([key, value]) => {
    // console.log('entries: ', { key, value, type: typeof value})
    notionData[key] = getNotionObject(value, key === primaryKey)
  })

  // console.log({ data, notionData })

  return notionData
}

const getValueFromNotionProperty = (property: any) => {
  
  // console.log({ property })
  
  // if date, interprets with mikroOrm Element, handle start/end
  if (property.type === 'date') {
    return new Date(property.date.start)
  }
  else {// rich_text or title
    return property[property.type][0]?.plain_text[0] === '[' && property[property.type][0]?.plain_text.endsWith(']') ||
    property[property.type][0]?.plain_text[0] === '{' && property[property.type][0]?.plain_text.endsWith('}') ?
    JSON.parse(property[property.type][0]?.plain_text) :
    property.type === 'number' ? property.number :
    property[property.type][0]?.plain_text
  }
}

// object is properties
export const getDataFromNotionObject = <T>(notionObject: any): T => {
  const data = {}
  
  Object.entries(notionObject).map(([key, value]) => {
    data[key] = getValueFromNotionProperty(value)
    // console.log({ key, value: data[key] })
  })
  
  return data as T
}

// TODO : type the return of the function
// TODO map several where properties, custom equals, contains, starts_with, ...
export const getNotionQueryFilterFromWhere = <T>(where: any) => {
  return {
    property: Object.keys(where)[0],
    text: {
      equals: Object.values(where)[0]
    },
  }
}

const notionDBIdsPath = './data/notionDBIds.json'
const notionDBIds = 'notionDBIds'

export const writeNotionDBIds = (notionDBIds) => {
  const notionDBIdsData = JSON.stringify(notionDBIds, null, 2)
  // @ts-ignore
  if (isNode()) {
    fs.writeFileSync(notionDBIdsPath, notionDBIdsData)
  }
  else {
    localStorage.setItem(notionDBIds, notionDBIdsData)
  }
}

export const readNotionDBIds = () => {
  // @ts-ignore
  if (isNode()) {
    if (!fs.existsSync(notionDBIdsPath)) return {}
    
    const notionDBIdsData = fs.readFileSync(notionDBIdsPath)
    // @ts-ignore
    return JSON.parse(notionDBIdsData)
  }
  else {
    const notionDBIdsData = localStorage.getItem(notionDBIds)

    if (notionDBIdsData === null) return {}
    // @ts-ignore
    return JSON.parse(notionDBIdsData)
  }
}

const getCreateNotionDBProperties = (primaryKey: string, properties: any) => {
  const notionDBProperties = {
    [primaryKey]: {
      title: {}
    }
  }

  for (const [key, value] of Object.entries(properties)) {
    if (key !== primaryKey) {
      let type
      if (value === 'string') {
        type = 'rich_text'
      } else if (value === 'date') {
        type = 'date'
      } else if (value === 'number') {
        type = 'number'
      } else if (value === 'boolean') {
        type = 'checkbox'
      } else {
        type = 'rich_text'
      }

      // @ts-ignore
      notionDBProperties[key] = {
        [type]: {}
      }
    }
  }

  return notionDBProperties
}

export const getCreateNotionDBBody = (notionDBPageId: string, title: string, primaryKey: string, data: any) => {
  
  const properties = {}

  for (const [key, value] of Object.entries(data)) {
    let type: string[] | string = Object.prototype.toString.call(value).split(' ')
    type = type[1].slice(0, type[1].length - 1).toLowerCase()

    // console.log({ type, key, value })
    // @ts-ignore
    if (type === 'string' && value.match(/\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)/)) {
      type = 'date'
    }
    else if (type === 'object') {
      // @ts-ignore
      type = value.constructor.name
      if (type === 'Collection') {
        // @ts-ignore
        type = value[0].constructor.name + '[]'
      }
    }

    properties[key] = type
    // properties[key] = typeof value === 'object' ? Object.prototype.toString.call(value) === '[object Date]' ? 'date' : typeof value
  }

  const notionDBProperties = getCreateNotionDBProperties(primaryKey, properties)

  // console.log({ notionDBPageId, title, data, properties, primaryKey, notionDBProperties })

  const body = {
    parent: {
      type: 'page_id',
      page_id: notionDBPageId
    },
    title: [{
      type: 'text',
      text: {
        content: title,
      }
    }],
    properties: notionDBProperties
  }

  // console.log({
  //   bodyJson: JSON.stringify(body)
  // })

  return body
}