const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const cardDATA = JSON.parse(cardPicPaths);
const innerTitle = document.getElementById("chead")
const name_ele = document.getElementById("uname")
const text_ele = document.getElementById("utext")
const type_ele = document.getElementById("utype")
const rsvp_ele = document.getElementById("rsvp")

const eventId = urlParams.get('event')

function renderCard(utype, utempl, uname, utext){
    const clist = Object.values(cardDATA[utype]["img"])
    const getInnerTitle = cardDATA[utype]["title"]
    name_ele.innerHTML = uname
    innerTitle.innerText = getInnerTitle
    text_ele.innerHTML = utext
    type_ele.innerHTML = `<img style="width:100%" src="${clist[utempl]}" alt="${getInnerTitle}">`

    // Hover only works with a mouse — tap-to-flip so phones (how guests will
    // actually open this link) can open the card and reach the RSVP form.
    document.querySelector(".page").addEventListener("click", function(){
        this.classList.toggle("flipped")
    })
}

function renderRsvp(){
    if (!rsvp_ele || !eventId || !supabaseClient) return

    rsvp_ele.innerHTML = `
        <input id="rsvp-name" placeholder="Tên của bạn" type="text">
        <button id="rsvp-yes">Sẽ tham dự</button>
        <button id="rsvp-no">Không tham dự được</button>
        <p id="rsvp-msg"></p>
    `

    async function submitRsvp(status){
        const guestName = document.getElementById("rsvp-name").value
        const msg = document.getElementById("rsvp-msg")
        if (!guestName) {
            msg.innerText = "Vui lòng nhập tên trước."
            return
        }
        const { error } = await supabaseClient
            .from("rsvps")
            .insert({ event_id: eventId, guest_name: guestName, status, responded_at: new Date().toISOString() })

        msg.innerText = error ? "Có lỗi, thử lại sau." : "Đã gửi phản hồi, cảm ơn bạn!"
    }

    document.getElementById("rsvp-yes").addEventListener("click", () => submitRsvp("yes"))
    document.getElementById("rsvp-no").addEventListener("click", () => submitRsvp("no"))
}

async function init(){
    if (eventId && supabaseClient) {
        const { data, error } = await supabaseClient
            .from("events")
            .select("card_type, template_no, host_name, message")
            .eq("id", eventId)
            .single()

        if (error || !data) {
            innerTitle.innerText = "Không tìm thấy thiệp này."
            return
        }

        renderCard(data.card_type, data.template_no, data.host_name, data.message)
        renderRsvp()
        return
    }

    // Fallback: old base64-in-URL flow (no backend configured)
    const uname = decodeURI(window.atob(urlParams.get('name')))
    const utext = decodeURI(window.atob(urlParams.get('text')))
    const utype = urlParams.get('card')
    const utempl = urlParams.get('templ')
    renderCard(utype, utempl, uname, utext)
}

init()
