const dotenv = require('dotenv');
dotenv.config();

const Airtable = require('airtable');
const moment = require('moment');
const {TOKEN, GUTIFYBASE_ID} = require('../config_new.json');
Airtable.configure({apiKey: TOKEN});
const {
   getDataByViewFields,
   createNotification,
   getSortedDataByViewName,
   getDataByViewName,
   createLog,
   getFilteredData,
   getViewDataByID,
   getRecordByIDs
} = require('../helper/common');

const gutify_base = Airtable.base(GUTIFYBASE_ID);

const DIAGNOSTIC_TABLE = 'Diagnostic Survey';
const DIETS_VIEW = 'Diets and medications';
const DIETS_FIELDS = [
   'Diagnostic_ID', 
   'Diets', 
   'BS Total Score'
];

const DIAGNOSTIC_ANSWER_VIEW = 'Diagnostic answers';
const DIAGNOSTIC_ANSWER_FIELDS = [
   'Diagnostic_ID', 
   'Customer_ID', 
   'Q01. What is your first name?', 
   'Number of Daily trackers submitted', 
   'Q14. Are you pregnant?'
];

const DIAGNOSTIC_QUESTIONS_TABLE = 'Diagnostic Questions';
const DIAGNOSTIC_QUESTIONS_VIEW = 'Flexible view';
const DIAGNOSTIC_QUESTIONS_FIELDS = ['Record ID', 'Answer'];

const CONDITION_TABLE = 'Conditions';
const CONDITION_VIEW = 'Grid view';
const CONDITION_FIELDS = ['Condition Name'];

const FOOD_TABLE = 'Food Table';
const FOOD_VIEW = 'Grid view';
const FOOD_FIELDS = ['Food Name'];

const NOT_PREGNANT = 'No - I am not pregnant';
const QUESTION_PREGNANT = 'Are you pregnant?';
const DIET_INVOLVED = 'FODMAP';
const CONDITION_NAME = "Starter";
const mapFoodNames = {};

console.log("Start");
const CustomerID = 'recyfjL9JHEK2olLR';

const calculate = async () => {
   
   // =================== Get records using getDataByViewFields function ================================================
   const [diagnosticAnswerViewRecords, dietsViewRecords, foodViewRecords] = await Promise.all([
      getViewDataByID(gutify_base, DIAGNOSTIC_TABLE, DIAGNOSTIC_ANSWER_VIEW, DIAGNOSTIC_ANSWER_FIELDS, 'Customer_ID', CustomerID),
      getViewDataByID(gutify_base, DIAGNOSTIC_TABLE, DIETS_VIEW, DIETS_FIELDS, 'Customer_ID', CustomerID),
      getDataByViewFields(gutify_base, FOOD_TABLE, FOOD_VIEW, FOOD_FIELDS)
   ]);

   foodViewRecords.forEach(record => {
      mapFoodNames[record.fields['Food Name']] = record.id;
   });

   const diagnosticAnswerViewData = diagnosticAnswerViewRecords[0].fields;
   const dietsViewData = dietsViewRecords[0].fields;

   // console.log(diagnosticAnswerViewData, 'diagnosticAnswerViewData');
   // console.log(dietsViewData, 'dietsViewData');

   // Get answer, diets, total BS score
   const answerID = diagnosticAnswerViewData['Q14. Are you pregnant?'][0];
   const answerRecord = await getViewDataByID(gutify_base, DIAGNOSTIC_QUESTIONS_TABLE, DIAGNOSTIC_QUESTIONS_VIEW, DIAGNOSTIC_QUESTIONS_FIELDS, 'Record ID', answerID);
   const customerID = diagnosticAnswerViewData['Customer_ID'][0];
   const firstName = diagnosticAnswerViewData['Q01. What is your first name?'];
   const numberOFDailyTrackers = diagnosticAnswerViewData['Number of Daily trackers submitted'];

   const conditionRecord = await getViewDataByID(gutify_base, CONDITION_TABLE, CONDITION_VIEW, CONDITION_FIELDS, 'Condition Name', CONDITION_NAME);
   const conditionID = conditionRecord[0]['id'];

   console.log(conditionID, 'conditionID of Starter');

   const dietsIDs = dietsViewData['Diets'];
   const dietsRecords = await getRecordByIDs(gutify_base, DIAGNOSTIC_QUESTIONS_TABLE, dietsIDs);
   const dietsData = dietsRecords.map(record => record['Name']);
   
   const BS = dietsViewData['BS Total Score'];

   console.log('-----------------------------------------------');
   console.log(answerRecord[0].fields, 'answerRecord');
   console.log(dietsData, 'dietsData');
   console.log(BS, 'BS');
   console.log('-----------------------------------------------');

   // Decide if she is pregnant, if there is 'FODMAP' in her diets.
   const isPregnant = answerRecord[0].fields['Answer'] != NOT_PREGNANT ? true : false;
   const hasFODMAP= dietsData.indexOf(DIET_INVOLVED) > -1 ? true : false;

   console.log(isPregnant, 'isPregnant');
   console.log(hasFODMAP, 'hasFODMAP');
   console.log('-----------------------------------------------');

   // ============================== Implement the logic of this algorithm ==========================
   // ------ Decide the value of On2Air Power Foods - Diane: according to the following conditions -----

   let on2AirPowerFoods = "";
   //****************************** Condtion1 - If she is pregnant and doesn't have FODMAP
   if (isPregnant && !hasFODMAP) on2AirPowerFoods = mapFoodNames["Goji berries infusion* (*max 8-10 berries a day) (*not during your menstruation unless explicitly asked)"];

   // Condtion2 - If she is pregnant and has FODMAP
   else if (isPregnant && hasFODMAP) on2AirPowerFoods = mapFoodNames["Lemon peel infusion"];

   // Condtion3 - If she is pregnant and doesn't have FODMAP
   else if (!isPregnant && hasFODMAP) on2AirPowerFoods = mapFoodNames["White rice and millet congee"];

   //***************************** Condtion4 - If she is pregnant and doesn't have FODMAP
   else if (hasFODMAP&& BS > 40) on2AirPowerFoods = mapFoodNames["Saffron infusion* (*not during your menstruation unless explicitly asked) (*max. 6 serves in total)"];

   // otherwise
   else on2AirPowerFoods = mapFoodNames["Chamomile and goji berries infusion"];


   const result = {
      'Customer_ID': [customerID],
      'Q01. What is your first name?': firstName,
      "Power Teas quantities and benefits": "To get started, please consider having this functional food once a day every day for 3 days.",
      "(1) Condition Selection A": [conditionID],
      "On2Air Power Foods - Diane": [on2AirPowerFoods],
      "Top 1 foods quantities and benefits": "",
      "(1) Condition Selection B": [],
      "On2Air Top 1 Foods - Diane": [],
      "Top 2 foods quantities and benefits": "",
      "(1) Condition Selection Add-on's": [],
      "On2Air Top 2 Foods - Diane": [mapFoodNames["No food needed!"]]
   }

   console.log(result, 'result');
   console.log('-----------------------------------------------');

   createLog(gutify_base, 'Diagnostic Survey', JSON.parse(JSON.stringify(result)));

}

// calculate();   