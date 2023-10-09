const dotenv = require('dotenv');
dotenv.config();

const Airtable = require('airtable');
const moment = require('moment');
const {TOKEN, GUTIFYBASE_ID} = require('../config.json');
Airtable.configure({apiKey: TOKEN});
const {
   getDataByViewFields,
   createNotification,
   getSortedDataByViewName,
   createPointsLog,
   getFilteredData
} = require('../helper/common');

const {getTop4TongueConditions} = require('./tongueController')

const gutify_base = Airtable.base(GUTIFYBASE_ID);

const PARAMETER_TABLE = 'Parameters for Algo #3';
const PARAMETER_VIEW = 'Grid view';
const PARAMETER_FIELDS = ['Number type', 'Number'];

const CONDITIONS_TABLE = 'Conditions';
const CONDITIONS_VIEW = 'Grid view'
const CONDITIONS_FIELDS = ['Condition Name'];

const NOTIFICATION_TABLE = 'Notifications';

const DAILYTRACKER_TABLE = 'Daily Tracker';
const DAILYTRACKER_VIEW = 'Sorted view';
const DAILYTRACKER_FIELDS = [
   'Diagnostic_ID',
   'Link to Diagnostic_ID',
   'First name',
   'Submission date',
   'Calendar date',
   'Where did you experience your migraine(s)?',
   'What was your level of pain today?',
   'Menstruation',
   'Bowel movement',
   'Customer ID'
];

const DAILYTRACKER_SORT = [
   {
      field: 'Calendar date',
      direction: 'desc'
   }
];

var mapParameters = {};                // Object for storing all parameters from the PARAMETER_TABLE.
var mapConditionNames = {};            // Object for storing all Conditions from the CONDITION_TABLE.
var MinNumberOfRecentDays = 3;         // initial value of "Min number of recent days that should have been tracked consecutively"
var MinNumberOfNeedDays = 7            // initial value of "Min number of days that need to have been tracked in the number of daily tracker days we look at"
var NumberOfDailyTrackerDays = 10;     // initial value of "Number of daily tracker days we look at"
var NumberOfABChangedDays = 28;        // initial value of "Number of days ago Selection A and Selection B changed"
var NumberOfConsiderationDays = 60;    // Number of days to take into consideration for daily trackers
var MinPMSDays = 3;                    // Min PMS days
var MaxPMSDays = 5;                    // Max PMS days
var PMSMigrainePoints = 2              // PMS Migraine points
var MinOvulationDays = 12;             // Min Ovulation days
var MaxOvulationDays = 16;             // Max Ovulation days
var OvulationMigrainePoints = 4;       // Ovulation Migraine points
var MinStartOfCycleDays = 1;           // Min start of cycle days
var MaxStartOfCycleDays = 5;           // Max start of cycle days
var AfterMigrainePoints = 5;           // After period Migraine points


const makeLastDateArray = (from, duration) => {
   let startDate = moment(from);
   let endDate = startDate.clone().subtract(duration-1, 'days');
   let dateArray = [];

   for(let curDate = startDate; curDate.isSameOrAfter(endDate); curDate.subtract(1,'days')){
      dateArray.push(curDate.format('YYYY-MM-DD'));
   }

   return dateArray;
}

const findLastIndex = (arr) => {
   for (let i = arr.length - 1; i >= 0; i--) {
     if (arr[i]['Menstruation'] == 'Yes - I am on my period' || arr[i]['Menstruation'] == 'Yes - spotting only')  return i;
   }
   return -1;
 }

const calculateConsecutiveDays = (records) => {

   let count = 1;
   let currentDate = new Date(records[0]['Calendar date']);
   
   for (let record of records) {
      const recordDate = new Date(record['Calendar date']);
      const diffDays = (currentDate - recordDate) / (1000 * 60 * 60 * 24);
      if (diffDays === 1) {
         count++;
         currentDate.setDate(currentDate.getDate() - 1);
      } else if (diffDays == 0) {
         continue;
      } else {
         
         break; // Break the loop as soon as there is a gap in consecutive days
      }
   }

   return count;
}

const makeNotication = (input) => {
   let new_notification = {};
   let _diagnostic_ID = input['Link to Diagnostic_ID'];
   let _message = "You are due for a list change, please continue to submit your daily trackers diligently so that we can identify the best food lists for your profile";
   let _what_happened = `This customer only has X daily trackers in the last  ${NumberOfDailyTrackerDays} (= 10 days) or only has X daily trackers in the last ${MinNumberOfRecentDays} (=3 days)`;
   let _customer_ID = input['Customer ID'];
   let _medical_vs = 'Medical';

   new_notification['Link to Diagnostic Survey'] = _diagnostic_ID;
   new_notification['Message'] = _message;
   new_notification['Automation notes'] = 'Triggered by Algo #3. Is due for list change and needs more trackers';
   new_notification['What happened'] = _what_happened;
   new_notification['Type'] = 'Algo #3';
   new_notification['Status'] = 'Pending approval';
   new_notification['Customer ID'] = _customer_ID;
   new_notification['Medical vs. Coaching vs. Wrong lists'] = _medical_vs;

   return JSON.parse(JSON.stringify(new_notification));
}

const getPoints = async(req, res) => {

   let MIGRAINEPOINTS = {
      "right":{
         "description":"Right pain location points",
         "condition": "QD",
         "points": 1,
         "total": 0
      },
      "left":{
         "description":"Left pain location points",
         "condition": "BS",
         "points": 1,
         "total": 0
      },
      "top":{
         "description":"Top pain location points",
         "condition": "LQS",
         "points": 1,
         "total": 0
      },
      "temple":{
         "description":"Temple pain location points",
         "condition": "LQS",
         "points": 1,
         "total": 0
      },
      "dizzy":{
         "description":"Dizzy pain location points",
         "condition": "YinDeficiency",
         "points": 1,
         "total": 0
      },
      "foggy":{
         "description":"Foggy pain location points",
         "condition": "Dampness",
         "points": 1,
         "total": 0
      },
      "behind my head":{
         "description":"Behind pain location points",
         "condition": "KD",
         "points": 1,
         "total": 0
      },
      "eyes":{
         "description":"Eyes pain location points",
         "condition": "LYD",
         "points": 2,
         "total": 0
      },
      "eyebrows":{
         "description":"Eyebrows pain location points",
         "condition": "LQS",
         "points": 1,
         "total": 0
      },
      "forehead":{
         "description":"Forehead pain location points",
         "condition": "SD",
         "points": 1,
         "total": 0
      },
      "ears":{
         "description":"Ears pain location points",
         "condition": "KD",
         "points": 1,
         "total": 0
      }
   };
   
   let BowelPoints = {
      "None": {
         "condition" : "YinDeficiency",
         "points": 2,
         "total": 0
      },
      "Type 1": {
         "condition" : "YinDeficiency",
         "points": 1,
         "total": 0
      },
      "Type 2": {
         "condition" : "YinDeficiency",
         "points": 0.5,
         "total": 0
      },
      "Type 3": {
         "condition" : "YinDeficiency",
         "points": 0.25,
         "total": 0
      },
      "Type 4": {
         "condition" : "-",
         "points": 0,
         "total": 0
      },
      "Type 5": {
         "condition" : "Dampness",
         "points": 0.25,
         "total": 0
      },
      "Type 6": {
         "condition" : "Dampness",
         "points": 1,
         "total": 0
      },
      "Type 7": {
         "condition" : "Dampness",
         "points": 2,
         "total": 0
      }
   }
   
   let TotalPoints = {
      "QD": 0,
      "BS": 0,
      "LQS": 0,
      "YinDeficiency": 0,
      "Dampness": 0,
      "KD": 0,
      "LYD": 0,
      "SD": 0,
      "LF": 0
   }

   const {DiagnosticID} = req.query;
   console.log(DiagnosticID, 'DiagnosticID');
   // ==========================get top 4 tongue conditions================================
   const task1_top4 = await getTop4TongueConditions();
   // =================== Get records using getDataByViewFields function ================================================
   const parameterViewRecords = await getDataByViewFields(gutify_base, PARAMETER_TABLE, PARAMETER_VIEW, PARAMETER_FIELDS);
   const dailyViewRecords = await getFilteredData(gutify_base, DAILYTRACKER_TABLE, DAILYTRACKER_VIEW, DAILYTRACKER_FIELDS, DAILYTRACKER_SORT, DiagnosticID);
   const conditionViewRecords = await getDataByViewFields(gutify_base, CONDITIONS_TABLE, CONDITIONS_VIEW, CONDITIONS_FIELDS);

   conditionViewRecords.forEach(record => {
      mapConditionNames[record.fields['Condition Name']] = record.id;
   });

   if (dailyViewRecords.length > 0){
      // ================= Get the max number of days since last tongue(=7 days) from the PARAMETER_TABLE =================
      parameterViewRecords.forEach(record => {
         mapParameters[record.fields["Number type"]] = record.fields["Number"];
      });
      MinNumberOfRecentDays = parseInt(mapParameters["Min number of recent days that should have been tracked consecutively"]);
      MinNumberOfNeedDays = parseInt(mapParameters["Min number of days that need to have been tracked in the number of daily tracker days we look at"]);
      NumberOfDailyTrackerDays = parseInt(mapParameters["Number of daily tracker days we look at"]);
      NumberOfABChangedDays = parseInt(mapParameters["Number of days ago Selection A and Selection B changed"]);
      NumberOfConsiderationDays = parseInt(mapParameters["Number of days to take into consideration for daily trackers"]);
      MinPMSDays = parseInt(mapParameters["Min PMS days"]);  
      MaxPMSDays = parseInt(mapParameters["Max PMS days"]);   
      PMSMigrainePoints = parseFloat(mapParameters["PMS Migraine points"]);       
      MinOvulationDays = parseInt(mapParameters["Min number of days between ovulation and menstruation"]);           
      MaxOvulationDays = parseInt(mapParameters["Max number of days between ovulation and menstruation"]);             
      OvulationMigrainePoints = parseFloat(mapParameters["Ovulation Migraine points"]);          
      MinStartOfCycleDays = parseFloat(mapParameters["Min start of cycle days"]);          
      MaxStartOfCycleDays = parseFloat(mapParameters["Max start of cycle days"]);          
      AfterMigrainePoints = parseFloat(mapParameters["After period Migraine points"]);          

      Object.keys(MIGRAINEPOINTS).forEach(key => {
         MIGRAINEPOINTS[key].points = mapParameters[MIGRAINEPOINTS[key].description];
      })

      // Extract only necessary data from records
      var dailyData = [];
      dailyViewRecords.forEach(record => {
         dailyData.push(record.fields);
      })

      // Calculate the consecutive days and the tracked days within the last {NumberOfDailyTrackerDays}(=10days) days.
      const consecutiveDays = calculateConsecutiveDays(dailyData);
      const dateArray_10days = makeLastDateArray(dailyData[0]['Calendar date'], NumberOfDailyTrackerDays);
      const trackDates_10days = dateArray_10days.filter(date => {
         // Check if the date exists in the 'Calendar date' field of any object in dailyData
         return dailyData.some(data => data['Calendar date'] === date);
      });

      console.log(consecutiveDays, MinNumberOfRecentDays, 'consecutiveDays');
      console.log(trackDates_10days,NumberOfABChangedDays, 'trackDates_10days');

      // ======================IF Condition1 or Condition2 Then Create a notification===============
      if (consecutiveDays < MinNumberOfRecentDays || trackDates_10days.length < MinNumberOfNeedDays) {

         let new_notification = makeNotication(dailyData[0]);
         createNotification(gutify_base, NOTIFICATION_TABLE, new_notification);
         return res.status(200).json(new_notification);
      } 

      // ==================IF Condition1 and Condition2 Then Create a notification===================
      if (consecutiveDays >= MinNumberOfRecentDays && trackDates_10days.length >= MinNumberOfNeedDays){
            
         // ==========Look at {Where did you experience your migraine(s)?} and assign points as such==========
         const dateArray_lastABdays = makeLastDateArray(dailyData[0]['Calendar date'], NumberOfABChangedDays);
         const filtered_dailyData = dailyData.filter(data => {
            return dateArray_lastABdays.some(date => data['Calendar date'] === date);
         });

         filtered_dailyData.forEach(data => {
            if(data.hasOwnProperty('Where did you experience your migraine(s)?')){
               data['Where did you experience your migraine(s)?'].forEach(item => {
                  let suffix_word = '';
                  Object.keys(MIGRAINEPOINTS).forEach(data => {
                     if(item.toLowerCase().includes(data)) {
                        suffix_word = data;
                        console.log(item, suffix_word, ' OK');
                        MIGRAINEPOINTS[suffix_word].total += MIGRAINEPOINTS[suffix_word].points;
                     }
                  })
               })
            }
         })

         console.log(MIGRAINEPOINTS, 'MIGRAINEPOINTS');
         Object.keys(MIGRAINEPOINTS).map(key => TotalPoints[MIGRAINEPOINTS[key]["condition"]] += MIGRAINEPOINTS[key]["total"]);
         console.log(TotalPoints, 'TotalPoints');

         // =================Calculate the first Menstruation date=======================
         const dateArray_ConsiderDays = makeLastDateArray(dailyData[0]['Calendar date'], NumberOfConsiderationDays);
         const lastDayOfConsider = dateArray_ConsiderDays[dateArray_ConsiderDays.length-1];

         const filtered_data = dailyData.filter(data => moment(data['Calendar date']).isSameOrAfter(moment(lastDayOfConsider)));
         const firstIndexOfMenstruation = findLastIndex(filtered_data);
         console.log(filtered_data[firstIndexOfMenstruation]["Calendar date"], 'first Menstruation date');

         // ============== Look at 3~5 days of trackers before the first Menstruation ======================
         const beforeFromDate_migraine = moment(filtered_data[firstIndexOfMenstruation]["Calendar date"]).subtract(MinPMSDays, 'days');
         const beforeToDate_migraine = moment(filtered_data[firstIndexOfMenstruation]["Calendar date"]).subtract(MaxPMSDays, 'days');
         console.log(beforeFromDate_migraine.format('YYYY-MM-DD'), beforeToDate_migraine.format('YYYY-MM-DD'), 'before-to')

         const betweenData1_migraine = filtered_data.filter(item => moment(item['Calendar date']).isSameOrBefore(beforeToDate_migraine) && moment(item['Calendar date']).isSameOrAfter(beforeFromDate_migraine));
         console.log(betweenData1_migraine, 'betweenData1_migraine')
         const sum_PMS = betweenData1_migraine.reduce((total, item) => {
            if (item["What was your level of pain today?"] != "I felt sharp and free!"){
               total += PMSMigrainePoints;
            }
            return total;
         }, 0);
         console.log(sum_PMS, 'sum_PMS')

         TotalPoints["LF"] += sum_PMS;

         // ============== Look at 12~16 days of trackers before the first Menstruation ======================
         const beforeFromDate_ovulation = moment(filtered_data[firstIndexOfMenstruation]["Calendar date"]).subtract(MinOvulationDays, 'days');
         const beforeToDate_ovulation = moment(filtered_data[firstIndexOfMenstruation]["Calendar date"]).subtract(MaxOvulationDays, 'days');
         console.log(beforeFromDate_ovulation.format('YYYY-MM-DD'), beforeToDate_ovulation.format('YYYY-MM-DD'), 'before-to')

         const betweenData1_ovulation = filtered_data.filter(item => moment(item['Calendar date']).isSameOrBefore(beforeFromDate_ovulation) && moment(item['Calendar date']).isSameOrAfter(beforeToDate_ovulation));
         console.log(betweenData1_ovulation, 'betweenData1_ovulation')
         const sum_ovulation = betweenData1_ovulation.reduce((total, item) => {
            if (item["What was your level of pain today?"] != "I felt sharp and free!"){
               total += OvulationMigrainePoints;
            }
            return total;
         }, 0);
         console.log(sum_ovulation, 'sum_ovulation')

         TotalPoints["KD"] += sum_ovulation;

         // =================Calculate the first Menstruation date=======================
         const lastIndexOfMenstruation = filtered_data.findIndex(item => item['Menstruation'] == 'Yes - I am on my period' || item['Menstruation'] == 'Yes - spotting only');
         console.log(filtered_data[lastIndexOfMenstruation]["Calendar date"], 'last Menstruation date');

         // ============== Look at 1~5 days of trackers after the last Menstruation ======================
         const afterFromDate_cycle = moment(filtered_data[lastIndexOfMenstruation]["Calendar date"]).add(MinStartOfCycleDays, 'days');
         const afterToDate_cycle = moment(filtered_data[lastIndexOfMenstruation]["Calendar date"]).add(MaxStartOfCycleDays, 'days');
         console.log(afterFromDate_cycle.format('YYYY-MM-DD'), afterToDate_cycle.format('YYYY-MM-DD'), 'after-to')

         const betweenData1_cycle = filtered_data.filter(item => moment(item['Calendar date']).isSameOrBefore(afterToDate_cycle) && moment(item['Calendar date']).isSameOrAfter(afterFromDate_cycle));
         console.log(betweenData1_cycle, 'betweenData1_ovulation')
         const sum_cycle = betweenData1_cycle.reduce((total, item) => {
            if (item["What was your level of pain today?"] != "I felt sharp and free!"){
               total += AfterMigrainePoints;
            }
            return total;
         }, 0);
         console.log(sum_cycle, 'sum_cycle')

         TotalPoints["YinDeficiency"] += sum_cycle;
         
         // ============== Bowel movements from the last 7 daily trackers ======================
         filtered_data.forEach(item => {
            if(item["Bowel movement"] !=""){
               item["Bowel movement"].split(",").forEach(data =>{
                  if(data.includes("None") || data.includes("Type")){
                     BowelPoints[data.trim()].total +=BowelPoints[data.trim()].points
                  }
               })
            }
         });

         console.log(BowelPoints, 'BowelPoints');
         Object.keys(BowelPoints).forEach(key => {
            if(key != 'Type 4') TotalPoints[BowelPoints[key]['condition']] += BowelPoints[key]['points'];
         })


         // console.log(dailyData, 'dailyData');
         console.log(consecutiveDays, 'consecutiveDays');
         console.log(trackDates_10days,NumberOfABChangedDays, 'trackDates_10days');
         // console.log(MIGRAINEPOINTS, 'MIGRAINEPOINTS');
         console.log(TotalPoints, 'TotalPoints');


         // get top 2 key-value pairs
         const entries = Object.entries(TotalPoints);
         const sortedEntries = entries.sort((a, b) => b[1] - a[1]);
         const top2Entries = sortedEntries.slice(0, 2);

         // create a new points log into the table "Points from past Daily Trackers for Alogo #3"
         const newTotalPoints = Object.entries(TotalPoints).reduce((acc, [key, value]) => {
            acc[`${key} Points`] = value;
            return acc;
         }, {});

         const pointsLog = {
            'Link to Diagnostic ID': dailyData[0]['Link to Diagnostic_ID'],
            "Tongue Top 4 conditions": String(task1_top4),
            "Recommendation - Top 1 Condition": [mapConditionNames[top2Entries[0][0]]],
            "Recommendation - Top 2": [mapConditionNames[top2Entries[1][0]]],
            ...newTotalPoints
         };

         const pointsLog1 = {
            'Link to Diagnostic ID': dailyData[0]['Link to Diagnostic_ID'],
            "Tongue Top 4 conditions": String(task1_top4),
            "Recommendation - Top 1 Condition": [top2Entries[0][0]],
            "Recommendation - Top 2": [top2Entries[1][0]],
            ...newTotalPoints
         };

         console.log(top2Entries, 'Recommendation');
         createPointsLog(gutify_base, 'Points from past Daily Trackers for Alogo #3', JSON.parse(JSON.stringify(pointsLog)));

         return res.json(pointsLog1);
      } 

   }
   
}

module.exports = {
   getPoints
}