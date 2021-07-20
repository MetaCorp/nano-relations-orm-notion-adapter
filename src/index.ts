
// @ts-ignore
import { Client } from '@notionhq/client'
// import { inspect } from 'util'
import { getCreateNotionDBBody, getDataFromNotionObject, getNotionData, getNotionQueryFilterFromWhere, isNode, readNotionDBIds, writeNotionDBIds } from './utils'

let fetch2


if (isNode()) {
  // @ts-ignore
  fetch2 = require('node-fetch')
}
else {
  fetch2 = fetch
}

// @ts-ignore

const defaultBaseUrl = 'https://api.notion.com'


const getNotionDBAdapter = ({
  notionDBPageId,
  entities,
  notionSecret,
  baseUrl = defaultBaseUrl
}: {
  notionDBPageId: string,
  entities: any,
  notionSecret: string,
  baseUrl?: string
}) => {
  const notion = new Client({
    auth: notionSecret,
    baseUrl,
  })

  const notionDBIds = readNotionDBIds()

  const createTable = async (body: any) => {

    // console.log({ title, body: inspect(body, false, 5) })

    const response = await fetch2(baseUrl + '/v1/databases/', {
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

  const find = async <T>(entityName: string, where: any, orderBy?: any, limit?: number, offset?: number): Promise<T[] | null> => {

    if (notionDBIds[entityName] === undefined) {
      console.log('Warning : No DBId for ' + entityName)
      return null
    }

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

    if (notionDBIds[entityName] === undefined) {
      console.log('Warning : No DBId for ' + entityName)
      return null
    }
    
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

    // console.log('nativeInsert :', { entityName, data })

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

  const nativeUpdate = async (entityName: string, where: any, data: any): Promise<any> => {

    // console.log('nativeUpdate :', { entityName, where, data })

    const notionData = getNotionData(data, entities[entityName].primaryKey)

    // TODO : is more optimize in term of performance to save the pageId in the notionDbTable
    const response = await notion.databases.query({
      database_id: notionDBIds[entityName],
      // @ts-ignore
      filter: getNotionQueryFilterFromWhere(where)
    })

    if (response.results === undefined || response.results.length === 0) {
      console.log(`${entityName} Not Found: `, { where, data })
      return null
    }

    return notion.pages.update({
      page_id: response.results[0].id,
      properties: notionData,
      archived: false,
    })
  }

  return {
    find,
    findOne,
    nativeInsert,
    nativeUpdate
  }
}

export default getNotionDBAdapter