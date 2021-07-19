
// import { inspect } from 'util'
// @ts-ignore
import { Client } from '@notionhq/client'

let fetch2

// @ts-ignore
if (typeof process === 'object' || typeof window === 'undefined') {
  // @ts-ignore
  fetch2 = require('node-fetch')
}
else {
  fetch2 = fetch
}

// @ts-ignore
import { getCreateNotionDBBody, getDataFromNotionObject, getNotionData, getNotionQueryFilterFromWhere, readNotionDBIds, writeNotionDBIds } from './utils'


const getNotionDBAdapter = (notionDBPageId: string, entities: any, notionSecret: string) => {
  const notion = new Client({ auth: notionSecret })

  const notionDBIds = readNotionDBIds()

  const createTable = async (body: any) => {

    // console.log({ title, body: inspect(body, false, 5) })

    const response = await fetch2('https://api.notion.com/v1/databases/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionSecret}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2021-05-13',
      },
      body: JSON.stringify(body)
    })

    const resData = await response.json()

    // console.log({ resData: inspect(resData, false, 6) })

    return resData.id
  }

  const find = async <T>(entityName: string, where: any, orderBy?: any, limit?: number, offset?: number): Promise<T[]> => {
    const response = await notion.databases.query({
      database_id: notionDBIds[entityName],
      // @ts-ignore
      filter: getNotionQueryFilterFromWhere(where)
    })

    const elements = response.results.map((result: any) => getDataFromNotionObject(result.properties))

    // @ts-ignore
    return elements
  }

  const findOne = async <T>(entityName: string, where: any | string, options?: any): Promise<T | null> => {
    const response = await notion.databases.query({
      database_id: notionDBIds[entityName],
      // @ts-ignore
      filter: getNotionQueryFilterFromWhere(where)
    })

    if (response.results.length === 0) {
      console.log(`Error: ${entityName} not found, where: ${JSON.stringify(where)}`)
      return null
    }

    const element: T = getDataFromNotionObject(response.results[0].properties)

    return element
  }

  const nativeInsert = async (entityName: string, data: any): Promise<any> => {

    if (notionDBIds[entityName] === undefined) {
      const notionDBBody = getCreateNotionDBBody(notionDBPageId, entityName, entities[entityName].primaryKey, data)
      notionDBIds[entityName] = await createTable(notionDBBody)
      writeNotionDBIds(notionDBIds)
    }
    
    const notionData = getNotionData(data, entities[entityName].primaryKey)
    
    return notion.pages.create({
      parent: {
        database_id: notionDBIds[entityName],
      },
      properties: notionData,
    })
  }

  return {
    find,
    findOne,
    nativeInsert
  }
}

export default getNotionDBAdapter