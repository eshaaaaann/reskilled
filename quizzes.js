// Question bank. Format: [question, CORRECT answer, wrong1, wrong2, wrong3]
// The correct answer's position is varied automatically. Add more rows to extend any course.
const RAW = {
'Essential Classroom Management Strategies': [
 ['What is the best first step in preventing classroom disruptions?','Teaching clear rules and routines early','Punishing the first student who misbehaves','Ignoring minor issues entirely','Seating students alphabetically'],
 ['Positive reinforcement means:','Rewarding desired behaviour so it is repeated','Removing privileges','Raising your voice','Giving extra homework'],
 ['A student keeps chatting. Your best first response is to:','Use proximity or a quiet, private reminder','Send them out immediately','Announce their name to the class','Cancel the lesson'],
 ['Why are consistent consequences important?','Students know what to expect and see them as fair','They frighten students into silence','They reduce lesson planning','They replace rules'],
 ['Smooth transitions between activities are achieved by:','Giving clear signals and instructions beforehand','Letting students decide when to move','Ending class early','Changing seats each time']],
'Classroom Management Tips': [
 ['A good attention signal is:','A consistent signal students have learned and practised','Shouting louder each time','Switching lights off randomly','Waiting silently for ten minutes'],
 ['A quick way to build rapport is to:','Use students\' names often in the first lessons','Avoid personal contact','Call students by seat number','Only talk to top students'],
 ['When giving instructions you should:','Be clear and brief, then check understanding','Give all steps very quickly at once','Whisper them once','Repeat them ten times'],
 ['Praise is most effective when it is:','Specific and immediate','Vague','Saved for the end of term','Given only to top students'],
 ['Staying calm when a student misbehaves:','Models respectful behaviour and keeps control','Shows weakness','Means you did not notice','Makes the problem worse']],
'Lesson Planning': [
 ['Effective lesson planning starts with:','Clear learning objectives','A fun game','The final activity','Homework'],
 ['SMART objectives are:','Specific, Measurable, Achievable, Relevant, Time-bound','Simple, Modern, Active, Realistic, Timed','Short, Mixed, Applied, Rated, Tested','Standard, Mandatory, Approved, Reviewed, Tracked'],
 ['A well-structured lesson usually flows:','Warm-up, presentation, practice, wrap-up','Closing, test, warm-up','Test only','In random order'],
 ['Why include a backup activity?','To cover time if tasks finish early or fail','Because students dislike the main task','To make lessons longer','It is never needed'],
 ['Differentiation means:','Adapting tasks to learners\' different needs','Giving every student the same task','Skipping weaker students','Using different tests to rank students']],
'Assessment Methods': [
 ['Formative assessment is:','Ongoing checking during learning to guide teaching','An end-of-year exam','Used only for ranking','An entrance test'],
 ['Which of these is summative assessment?','A final exam at the end of term','An exit ticket','A thumbs up/down check','Observation notes during class'],
 ['A rubric helps by:','Giving clear criteria for grading and feedback','Hiding how work is marked','Removing the need for feedback','Making marking random'],
 ['A benefit of peer assessment is:','Students learn to judge quality and reflect','The teacher stops assessing','It encourages cheating','It replaces learning goals'],
 ['Good feedback should be:','Specific, timely and actionable','Only a grade','Given a year later','Only negative']],
'KWL Charts': [
 ['KWL stands for:','Know, Want to know, Learned','Keep, Write, Learn','Know, Wonder, Link','Key, Word, List'],
 ['The "K" column is filled in:','Before learning, to activate prior knowledge','After the lesson','Never','By the teacher alone'],
 ['The "W" column helps students:','Set questions and a purpose for learning','Record test scores','List vocabulary only','Assign homework'],
 ['The "L" column is completed:','During or after learning, to record what was learned','Before the "K" column','At the start of the year','Only by the teacher'],
 ['A key benefit of KWL charts is that they:','Connect new information to prior knowledge','Replace lessons','Shorten the curriculum','Remove the need for tests']],
'What to Do on the First Day of School': [
 ['A priority on the first day is:','Building a welcoming atmosphere and introducing routines','Giving a heavy test','A long lecture','Strict punishments'],
 ['A good way to start is to:','Greet students at the door','Wait inside until the bell','Skip names','Only hand out textbooks'],
 ['Why teach procedures early?','They save time and prevent problems later','They waste time','They are only for young students','They are not needed'],
 ['Class expectations should be:','Explained clearly and stated positively','Kept secret','Changed daily','Decided after problems occur'],
 ['The purpose of a first-day icebreaker is to:','Help students relax and get to know each other','Test grammar','Take attendance only','Punish latecomers']],
'Out-of-the-Box Icebreaker Ideas': [
 ['The main aim of an icebreaker is to:','Reduce nervousness and build rapport','Grade students','Teach new grammar','Fill silence'],
 ['"Two truths and a lie" practises:','Sharing facts and listening carefully','Maths skills','Handwriting','Silent reading'],
 ['A good icebreaker is:','Low-pressure, inclusive and quick to explain','Embarrassing','Long and complicated','Only for confident students'],
 ['When choosing icebreakers, teachers should:','Avoid questions that are too personal','Force students to share private details','Ignore shy students','Use them only with adults'],
 ['Icebreakers can be used:','Anytime to re-energise or form groups','Only on the first day','Never again after week one','Only during exams']],
'How to Prepare for a Demo Lesson': [
 ['The first step in preparing is to:','Know your audience and lesson objective','Memorise a script','Buy props','Finish early'],
 ['To manage timing you should:','Rehearse to fit the allotted time','Ignore the clock','Talk as fast as possible','Skip the warm-up'],
 ['Observers of a demo lesson mainly look for:','Clear instructions, interaction and engagement','Your handwriting only','Your resume','The size of the room'],
 ['If something goes wrong during the demo:','Stay calm and adapt','Stop and apologise repeatedly','Blame the technology','Leave the room'],
 ['Good teaching materials are:','Clear, relevant and checked in advance','Cluttered','Untested','Optional']],
'Time Management': [
 ['A tool for ranking tasks by urgency and importance is:','The Eisenhower matrix','The Pythagorean theorem','A bell curve','A pie chart'],
 ['Effective teachers usually:','Plan ahead with weekly schedules','Plan only on the day','Never plan','Plan only at term end'],
 ['Procrastination is best reduced by:','Breaking tasks into small steps with deadlines','Waiting for motivation','Multitasking constantly','Doing only the easiest tasks'],
 ['A good way to handle marking is to:','Set aside focused blocks of time','Mark at random moments','Avoid marking','Mark during lessons'],
 ['Saying "no" to extra tasks is:','Sometimes necessary to protect priorities','Always rude','Never allowed','Harmful to students']],
'Task-Based Lesson Tips': [
 ['Task-based learning focuses on:','Completing meaningful tasks using the skills learned','Memorising word lists','Teacher-only lectures','Silent tests'],
 ['A typical task-based lesson has:','Pre-task, task and post-task/review','Test, test, test','Lecture, lecture, exam','A warm-up only'],
 ['A good task has:','A clear goal or outcome','No purpose','Only teacher talk','Only copying from the board'],
 ['During the task, the teacher should:','Monitor, support and note language for feedback','Leave the room','Dominate the talking','Correct every mistake immediately'],
 ['The post-task stage is for:','Reflection, review of language and feedback','Ignoring the results','Punishment','Starting an unrelated unit']]
};
const bank = {};
Object.keys(RAW).forEach((c, ci) => bank[c] = RAW[c].map(([q, ok, ...w], qi) => {
  const pos = (qi + ci) % 4, o = w.slice(); o.splice(pos, 0, ok); return [q, o, pos];
}));
module.exports = bank;
