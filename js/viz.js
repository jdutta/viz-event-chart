(function () {
    let distractedEngagedData = []
    let quizData = []
    let vizEl = null
    let vizWrapperEl = null
    let sortInputEl = null
    let config = {
        margin: {
            top: 10,
            right: 10,
            bottom: 10,
            left: 10
        },
        userLabelWidth: 150,
        barHeight: 20,
        barGap: 5
    }
    // let engagementDataFile = 'data/distracted_engaged_info.json'
    let engagementDataFile = 'data/5213_time_bounded_all_users_gotcha_times.json'
    // let quizDataFile = 'data/zombie_responses_info.json'
    let quizDataFile = 'data/5213_ruts_data.json'
    const sortByEnums = {
        ATTENTION: 'attention',
        DISTRACTION: 'distraction',
        QUIZZES: 'quizzes',
        ANSWERS_CORRECT: 'answers-correct'
    }

    function init() {
        let drawChartPayload = {
            engagementData: distractedEngagedData,
            quizData: quizData
        }
        // console.log('init', distractedEngagedData, quizData)
        vizWrapperEl = document.getElementById('vizWrapper')
        vizEl = document.getElementById('viz')
        sortInputEl = document.getElementById('sort-input-selection')
        sortInputEl.addEventListener('change', function (evt) {
            drawChart({
                ...drawChartPayload,
                sortBy: evt.target.value
            })
        })
        drawChart({
            ...drawChartPayload,
            sortBy: sortByEnums.ATTENTION
        })
    }

    function loadDataFiles() {
        let p1 = new Promise(function (resolve, reject) {
            d3.json(engagementDataFile, function (error, data) {
                distractedEngagedData = data
                resolve()
            })
        })
        let p2 = new Promise(function (resolve, reject) {
            d3.json(quizDataFile, function (error, data) {
                quizData = data
                resolve()
            })
        })
        return Promise.all([p1, p2])
    }

    function processData(payload) {
        let filteredEngagementData = _.filter(payload.engagementData, o => ['opened', 'closed'].indexOf(o.event) < 0 )
        let userToEngagementData = _.groupBy(filteredEngagementData, o => o.user_id)
        let userToQuizData = _.groupBy(payload.quizData, o => o.user_id)
        // console.log('userToEngagementData, userToQuizData', userToEngagementData, userToQuizData)
        let minTs = _.min(filteredEngagementData.map(o => new Date(o.start_time).getTime()))
        let maxTs = _.max(filteredEngagementData.map(o => new Date(o.end_time).getTime()))
        console.log('minTs, maxTs', minTs, maxTs)

        let userIdToEmail = {}
        payload.quizData.forEach(o => {
            userIdToEmail[o.user_id] = o.user_email
        })

        let userStats = {} // userId -> { totalAttention, totalDistraction, totalQuizzes, totalCorrectAnswers }
        let users = Object.keys(userToEngagementData)
        users.forEach(userId => {
            let engagementData = userToEngagementData[userId]
            let totalAttention = 0
            let totalDistraction = 0
            engagementData.forEach(o => {
                if (o.event === 'attentive') {
                    totalAttention += o.length
                } else {
                    totalDistraction += o.length
                }
            })

            let quizData = userToQuizData[userId]
            let totalQuizzes = quizData ? quizData.length : 0
            let totalCorrectAnswers = 0
            if (totalQuizzes) {
                totalCorrectAnswers = quizData.filter(o => o.message === 'Zombie::QuestionAnsweredCorrectly').length
            }

            userStats[userId] = {
                totalAttention,
                totalDistraction,
                totalQuizzes,
                totalCorrectAnswers
            }
        })
        // console.log('userStats', userStats)

        const sortByToField = {
            [sortByEnums.ATTENTION]: 'totalAttention',
            [sortByEnums.DISTRACTION]: 'totalDistraction',
            [sortByEnums.QUIZZES]: 'totalQuizzes',
            [sortByEnums.ANSWERS_CORRECT]: 'totalCorrectAnswers',
        }
        // sort users array based on payload.sortBy
        function comparatorFn(uid1, uid2) {
            let stat1 = userStats[uid1]
            let stat2 = userStats[uid2]
            let field = sortByToField[payload.sortBy]
            return stat1[field] === stat2[field] ? 0 : (stat1[field] > stat2[field] ? -1 : 1)
        }
        users = users.sort(comparatorFn)

        return {
            userToEngagementData,
            userToQuizData,
            userIdToEmail,
            userStats,
            users,
            minTs,
            maxTs
        }
    }

    function textEllipsis(width, padding) {
        return function () {
            let self = d3.select(this),
                textLength = self.node().getComputedTextLength(),
                text = self.text();
            while (textLength > (width - 2 * padding) && text.length > 0) {
                text = text.slice(0, -1);
                self.text(text + '...');
                textLength = self.node().getComputedTextLength();
            }
        }
    }

    function removeChildNodes(el) {
        while (el.childNodes.length) {
            el.removeChild(el.childNodes[0])
        }
    }

    function drawChart(payload) {
        let data = processData(payload)

        let margin = config.margin
        let containerSize = {
            w: vizWrapperEl.offsetWidth,
            h: Math.max(vizWrapperEl.offsetHeight, margin.top + margin.bottom + data.users.length * (config.barHeight + config.barGap))
        }

        let width = containerSize.w - margin.left - margin.right
        let height = containerSize.h - margin.top - margin.bottom
        let gRootXY = [margin.left, margin.top]
        removeChildNodes(vizEl)

        let svg = d3.select(vizEl)
            .attr('width', containerSize.w)
            .attr('height', containerSize.h)
        let gRoot = svg.append('svg:g').attr('transform', 'translate(' + gRootXY + ')')

        let xScale = d3.scaleLinear()
            .domain([data.minTs, data.maxTs])
            .range([config.userLabelWidth, width])

        data.users.forEach((userId, userIndex) => {
            let userEmail = data.userIdToEmail[userId]
            let engagementData = data.userToEngagementData[userId]
            let quizData = data.userToQuizData[userId]
            let gUserEngagement = gRoot.append('svg:g')
                        .classed('user-engagement', true)
                .attr('transform', 'translate('+[0, userIndex * (config.barHeight + config.barGap)]+')')
            gUserEngagement.append('svg:rect')
                .classed('user-timeline', true)
                .attr('x', 0)
                .attr('y', 0)
                .attr('width', width)
                .attr('height', config.barHeight)
            engagementData.forEach(o => {
                let startTs = new Date(o.start_time).getTime()
                let endTs = new Date(o.end_time).getTime()
                let x1 = xScale(startTs)
                let x2 = xScale(endTs)
                if (x2 - x1 < 0) {
                    return
                }
                // console.log('x1 x2', x1, x2)
                let isAttention = o.event === 'attentive'
                gUserEngagement.append('svg:rect')
                    .classed('attention', isAttention)
                    .classed('distraction', !isAttention)
                    .attr('x', x1)
                    .attr('y', 0)
                    .attr('width', x2 - x1)
                    .attr('height', config.barHeight)
                    .append('title')
                    .text(`${isAttention ? 'Attention' : 'Distraction'} span for user ${o.user_id} from ${o.start_time} to ${o.end_time}`)
            })
            let userLabel = userEmail || `User ${userId}`
            let gText = gUserEngagement.append('svg:text')
                .classed('user-label', true)
                .attr('x', 0)
                .attr('y', 15)
                .text(userLabel)
            gText.each(textEllipsis(config.userLabelWidth, 0))

            gText.append('svg:title')
                .text(userLabel + ': ' + JSON.stringify(data.userStats[userId]))

            if (quizData) {
                let gUserQuiz = gRoot.append('svg:g')
                    .classed('user-quiz', true)
                    .attr('transform', 'translate('+[0, userIndex * (config.barHeight + config.barGap)]+')')
                quizData.forEach(o => {
                    let ts = new Date(o['@timestamp']).getTime()
                    let x = xScale(ts)
                    let isCorrect = o.message === 'Zombie::QuestionAnsweredCorrectly'
                    let isIncorrect = o.message === 'Zombie::QuestionAnsweredIncorrectly'
                    gUserQuiz.append('svg:circle')
                        .classed('answer-correct', isCorrect)
                        .classed('answer-incorrect', isIncorrect)
                        .attr('cx', x)
                        .attr('cy', config.barHeight / 2)
                        .attr('r', 5)
                        .append('title')
                        .text(`Response: ${o.response}, Timestamp: ${o['@timestamp']}`)
                })
            }
        })
    }

    loadDataFiles().then(init)
})()