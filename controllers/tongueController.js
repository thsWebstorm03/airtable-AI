const dotenv = require('dotenv');
dotenv.config();

const Airtable = require('airtable');
const {TOKEN, GUTIFYBASE_ID} = require('../config.json');
Airtable.configure({apiKey: TOKEN});
const {getDataByViewFields, convertToCSV} = require('../helper/common');

const base = Airtable.base(GUTIFYBASE_ID);

const PREVIOUSLIST_TABLE = 'Previous lists';
const PREV_VIEW = 'Grid view'
const PREV_FIELDS = ['Date', 'Condition A', 'Condition B', 'Diagnostic_ID'];

const DIAGNOSTICSURVEY_TABLE = 'Diagnostic Survey';
const SCORING_VIEW = 'Scoring'
const SCORE_FIELDS = [
   'Diagnostic_ID',
   'LQS %',
   'BVD %',
   'LYD %',
   'SD %',
   'YinDeficiency %',
   'QD %',
   'LF %',
   'BS %',
   'KD %',
   'Dampness %',
   'W %',
   'P %',
   'Cold %',
   'Heat %',
   'GB %',
   'LungYinDeficiency %'
];

const CONDITIONS_TABLE = 'Conditions';
const CONDITIONS_VIEW = 'Grid view'
const CONDITIONS_FIELDS = ['Condition Name'];

const PARAMETER_TABLE = 'Parameters for Algo #3';
const PARAMETER_VIEW = 'Grid view';
const PARAMETER_FIELDS = ['Number type', 'Number'];

var conditionLimit = 6;       // initial value of the limit of conditions done. it will come from PARAMETER_TABLE in the code.

const mapConditionNames = {};
const mapParameters = {};
var result = "";
var final_obj = {};

const getTop4TongueConditions = async(req, res) => {

   const parameterViewRecords = await getDataByViewFields(base, PARAMETER_TABLE, PARAMETER_VIEW, PARAMETER_FIELDS);
   const previousViewRecords = await getDataByViewFields(base, PREVIOUSLIST_TABLE, PREV_VIEW, PREV_FIELDS);
   const scoringViewRecords = await getDataByViewFields(base, DIAGNOSTICSURVEY_TABLE, SCORING_VIEW, SCORE_FIELDS);
   const conditionViewRecords = await getDataByViewFields(base, CONDITIONS_TABLE, CONDITIONS_VIEW, CONDITIONS_FIELDS);

   parameterViewRecords.forEach(record => {
      mapParameters[record.fields["Number type"]] = record.fields["Number"];
   });
   conditionLimit = parseInt(mapParameters["Conditions done from the online test"]);

   conditionViewRecords.forEach(record => {
      mapConditionNames[record.id] = record.fields['Condition Name'];
   });

   const previous_data = []
   previousViewRecords.forEach(record => {
      let conditions = new Set();
      record.fields['Condition A']
         ?.map(item => conditions.add(mapConditionNames[item]));
      record.fields['Condition B']
         ?.map(item => conditions.add(mapConditionNames[item]));

      // remove the Starter
      conditions.delete('Starter');

      //  Check if the length of the combined conditions are less than 6
      if ([...conditions].length < conditionLimit) {
         const matching_scoreObject = scoringViewRecords.find(obj => obj.fields["Diagnostic_ID"] == "GY" + record.fields['Diagnostic_ID'][0]);
         if (matching_scoreObject) {
            let temp = {
               ...matching_scoreObject.fields
            };
            let minval = 1000;
            conditions.forEach(condition => {
               const keyToRemove = `${condition} %`;
               if (temp[keyToRemove] < minval && temp[keyToRemove]) 
                  minval = parseFloat(temp[keyToRemove]);
               delete temp[keyToRemove];
            });

            let filtered_scoreObject = Object
               .keys(temp)
               .filter(key => temp[key] < minval)
               .sort((a, b) => temp[b] - temp[a]);

            let obj = {};
            filtered_scoreObject
               .slice(0, 4)
               .forEach(item =>{
                  key = item.substring(0, item.length - 2);
                  value = Math.round(temp[item] * 100) / 100;
                  obj[key] = value;
                  if(final_obj[key]){
                     final_obj[key] = Math.max(value, parseFloat(final_obj[key]));
                  } else {
                     final_obj[key] = value;
                  }
                  
               })

         }
      } else {
         console.log("The different items in conditions A & B are more than 6");
      }

   });

   // put the result
   result = Object.entries(final_obj)
      .slice(0,4)
      .map(([key, value]) => `${key}:${value}`)
      .join(', ')

   return res.status(200).json(result);
   
}

module.exports = {
   getTop4TongueConditions
}