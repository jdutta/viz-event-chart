(function () {
    let distractedEngagedData = []
    let quizData = []
    let attnScoreData = []
    let vizEl = null
    let vizWrapperEl = null
    let tooltipModel = {
        selector: '.svg-wrapper .tooltip',
        selectorUserInfo: '.svg-wrapper .tooltip .user-info',
        selectorUserStats: '.svg-wrapper .tooltip .user-stats',
        selectorActionDetails: '.svg-wrapper .tooltip .action-details',
        selectorActionRemedial: '.svg-wrapper .tooltip .action-remedial',
        width: 200,
        height: 120,
        currentUser: null
    }
    let sortInputEl = null
    let config = {
        margin: {
            top: 10,
            right: 10,
            bottom: 10,
            left: 10
        },
        userLabelWidth: 150,
        userLabelClickable: true,
        barHeight: 20,
        barGap: 5
    }
    // let engagementDataFile = 'data/distracted_engaged_info.json'
    let engagementDataFile = 'data/5213_time_bounded_all_users_gotcha_times.json'
    // let quizDataFile = 'data/zombie_responses_info.json'
    let quizDataFile = 'data/5213_ruts_data.json'
    let attnScoreDataFile = 'data/5213_attn_score_data.json'
    const sortByEnums = {
        ATTENTION_SCORE: 'attention-score',
        ATTENTION: 'attention',
        DISTRACTION: 'distraction',
        QUIZZES: 'quizzes',
        ANSWERS_CORRECT: 'answers-correct'
    }

    function init() {
        let drawChartPayload = {
            engagementData: distractedEngagedData,
            quizData: quizData,
            attnScoreData: attnScoreData
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
            sortBy: sortByEnums.ATTENTION_SCORE
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
        let p3 = new Promise(function (resolve, reject) {
            d3.json(attnScoreDataFile, function (error, data) {
                attnScoreData = data
                resolve()
            })
        })
        return Promise.all([p1, p2, p3])
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

        let userToAttnScore = {}
        payload.attnScoreData.forEach(o => {
            userToAttnScore[o.user_id] = o.attn_score
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
                attnScore: userToAttnScore[userId] || 0,
                totalAttention,
                totalDistraction,
                totalQuizzes,
                totalCorrectAnswers
            }
        })
        // console.log('userStats', userStats)

        const sortByToField = {
            [sortByEnums.ATTENTION_SCORE]: 'attnScore',
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

    function onUserLabelClick(payload) {
        console.log('user', payload)
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

    function getFormattedUserStatsForTooltip(stats) {
        let text = ''
        _.forOwn(stats, function (v, k) {
            if (text) {
                text += '\n'
            }
            text += k + ': ' + v
        })
        return text
    }

    function getHtmlFormattedUserStatsForTooltip(stats) {
        let text = ''
        _.forOwn(stats, function (v, k) {
            if (text) {
                text += '<br>'
            }
            text += k + ': ' + v
        })
        return text
    }

    function onUserLabelMouseOver(payload) {
        let labelEl = d3.select(this)
        let labelRect = this.getBoundingClientRect()
        tooltipModel.currentUser = payload
        d3.select(tooltipModel.selectorUserInfo).html(payload.userEmail || `User ${payload.userId}`)
        d3.select(tooltipModel.selectorUserStats).html(getHtmlFormattedUserStatsForTooltip(payload.stats))

        d3.select(tooltipModel.selector)
            .transition()
            .style('opacity', 1)
            // .style('width', tooltipModel.width)
            .style('height', tooltipModel.height)
            .style('left', labelRect.right)
            .style('top', labelRect.top - tooltipModel.height / 2)
    }

    function onUserLabelMouseOut() {
        d3.select(tooltipModel.selector)
            .transition().duration(1000).style('opacity', 0)
            .transition()
            .style('left', -9999)
    }

    function onTooltipMouseOver() {
        d3.select(tooltipModel.selector).transition()
            .style('opacity', 1)
    }

    function onTooltipMouseOut() {
        onUserLabelMouseOut()
    }

    function onTooltipActionShowDetails() {
        console.log('show details', tooltipModel.currentUser)
    }

    function onTooltipActionRemedial() {
        console.log('take remedial action', tooltipModel.currentUser)
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
            let attnScore = data.userStats[userId].attnScore
            let userLabelWithAttnScore = `[${attnScore}] ${userLabel}`
            let gText = gUserEngagement.append('svg:text')
                .classed('user-label', true)
                .classed('clickable', config.userLabelClickable)
                .attr('x', 0)
                .attr('y', 15)
                .text(userLabelWithAttnScore)
            gText.each(textEllipsis(config.userLabelWidth, 0))

            /*
            gText.append('svg:title')
                .text(userLabel + '\n\n' + getFormattedUserStatsForTooltip(data.userStats[userId]))
            //*/

            gText.on('mouseover', function () {
                onUserLabelMouseOver.call(this, {
                    userId,
                    userEmail,
                    stats: data.userStats[userId]
                })
            })
            gText.on('mouseout', onUserLabelMouseOut)
            d3.select(tooltipModel.selector).on('mouseover', onTooltipMouseOver)
            d3.select(tooltipModel.selector).on('mouseout', onTooltipMouseOut)
            d3.select(tooltipModel.selectorActionDetails).on('click', onTooltipActionShowDetails)
            d3.select(tooltipModel.selectorActionRemedial).on('click', onTooltipActionRemedial)

            /*
            if (config.userLabelClickable) {
                gText.on('click', function () {
                    onUserLabelClick({
                        userId: userId,
                        userEmail: userEmail || ''
                    })
                })
            }
            //*/

            if (quizData) {
                let gUserQuiz = gRoot.append('svg:g')
                    .classed('user-quiz', true)
                    .attr('transform', 'translate('+[0, userIndex * (config.barHeight + config.barGap)]+')')
                quizData.forEach(o => {
                    let ts = new Date(o['@timestamp']).getTime()
                    let x = xScale(ts)
                    let isCorrect = o.message === 'Zombie::QuestionAnsweredCorrectly'
                    let isIncorrect = o.message === 'Zombie::QuestionAnsweredIncorrectly'
                    gUserQuiz.append('svg:text')
                        .classed('answer-correct', isCorrect)
                        .classed('answer-incorrect', isIncorrect)
                        .attr('x', x)
                        .attr('y', config.barHeight / 2 + 5)
                        .text(isCorrect ? '\u2713' : '\u2717')
                        .append('title')
                        .text(`Response: ${o.response}\nScore: ${o.score}\nTimestamp: ${o['@timestamp']}`)
                })
            }
        })
    }

    loadDataFiles().then(init)
})()