const getDataByTableName = async(base, table_name) => {}

// ============================== Get table data by view ============================================
const getDataByViewName = async(base, table_name, view_name) => {
   let allRecords = [];
   try {
      allRecords = await base(table_name).select({view: view_name}).all();
      return allRecords;
   } catch (err) {
      console.error(err);
      throw err;
   }
}

// ============================== Get table data by view sorting them in a specific order ============================================
const getSortedDataByViewName = async(base, table_name, view_name, fields, sort) => {
   let allRecords = [];
   try {
      allRecords = await base(table_name).select({fields: fields, view: view_name}).all();
      return allRecords;
   } catch (err) {
      console.error(err);
      throw err;
   }
}

// =============================== Get table data by field names of the view ========================
const getDataByViewFields = async(base, table_name, view_name, fields) => {
   let allRecords = [];
   try {
      allRecords = await base(table_name).select({fields: fields, view: view_name}).all();
      return allRecords;
   } catch (err) {
      console.error(err);
      throw err;
   }
}

// ============================ Get the table data by filtering =====================================
const getFilteredData = async(base, table_name, view_name, fields, sort, customerId) => {
   let allRecords = [];
   try {
      allRecords = await base(table_name).select({fields: fields,sort: sort, filterByFormula: `SEARCH('${customerId}', {Link to Diagnostic_ID})`}).all();
      return allRecords;
   } catch (err) {
      console.error(err);
      throw err;
   }
}

// ============== Create a new notification into the table "Notifications", Gutify DB ================
const createNotification = async(base, table_name, notification) => {
   await base(table_name).create([
      {
         fields: notification
     }]
  , function(err, records) {
      if (err) {
          console.error('Error creating notification:', err);
          return;
      }
      records.forEach(function (record) {
          console.log('Created notification:', record.getId());
      });
  });
}

// ============== Create a new notification into the table "Notifications", Gutify DB ================
const createPointsLog = async(base, table_name, pointsLog) => {
   await base(table_name).create([
      {
         fields: pointsLog
     }]
  , function(err, records) {
      if (err) {
          console.error('Error creating notification:', err);
          return;
      }
      records.forEach(function (record) {
          console.log('Created notification:', record.getId());
      });
  });
}

// ================ Get the top 4 conditions from String =============================================
const getTop4FromString = (input) => {
   const pairs = input.split(',').map(pair => pair.trim().split(':')).map(([key, value]) => [key, parseFloat(value)]);
   const obj = Object.fromEntries(pairs);
   const sortedEntries = Object.entries(obj).sort(([, valueA], [, valueB]) => valueB - valueA);
   const filteredEntries = sortedEntries.filter(([, value]) => value >=0.3);
   const top4Entries = filteredEntries.slice(0, 4);
   return top4Entries;
}

// ================ Get the top 4 conditions by Priority =============================================
const getTop4ByPriority = (conditions) => {
   const conditionEntries = Object.entries(conditions).map(([key, value]) => {
      const match = key.match(/^(.+)_(High|Medium|Low)$/);
      if(match){
         return {
             condition: match[1],
             adjective: match[2],
             prevalence: value,
         };
      } else{
         return {
            condition: key,
            adjective: 'other',
            prevalence: value
         }
      }

   });
   
   const adjectivePriority = {
         High: 3,
         Medium: 2,
         Low: 1,
         other:0
   };
   
   const sortedConditions = conditionEntries.sort((a, b) => {
         // Sort by adjective priority, if they are the same, then sort by prevalence
         return (adjectivePriority[b.adjective] - adjectivePriority[a.adjective]) || (b.prevalence - a.prevalence);
   });
   
   const topConditions = sortedConditions.slice(0, 4); // get the top 4 conditions
   // console.log(topConditions);
   return topConditions;
}

// =================== sort an Object in descend order ==================================================
const sortObj = (obj) => {
   const entries = Object.entries(obj);
   const filteredEntries = entries.filter(([key]) => key !== 'Diagnostic_ID');
   const sortedEntries = filteredEntries.sort(([
      , value1
   ], [, value2]) => value2 - value1);

   const sortedObj = Object.fromEntries(sortedEntries);
   sortedObj.Diagnostic_ID = obj.Diagnostic_ID;

   return sortedObj;
}

// ================== convert the data into csv format =====================================================
const convertToCSV = (data) => {
   // Create header
   const csvHeader = '"Date","Diagnostic_ID","Conditions","next_scores (%)"\n';

   // Create content
   const csvContent = data.map(({Date, Diagnostic_ID, Conditions, next_scores}) => {
      const conditionsStr = Conditions.join('|');
      const next_scoresStr = JSON.stringify(next_scores);

      return `"${Date}","${Diagnostic_ID}","${conditionsStr}","${next_scoresStr}"`;
   }).join('\n');

   return csvHeader + csvContent;
}

module.exports = {
   getDataByTableName,
   getDataByViewName,
   getSortedDataByViewName,
   getDataByViewFields,
   getFilteredData,

   createNotification,
   createPointsLog,
   getTop4FromString,
   getTop4ByPriority,
   sortObj,
   convertToCSV
}