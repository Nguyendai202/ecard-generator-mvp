const cardDATA = JSON.parse(cardPicPaths);

const ctype = document.getElementById("ctype")
const ctypeArray = Object.keys(cardDATA)
for(let k=0; k<ctypeArray.length; k++) {
    ctype.innerHTML += `<option value="${ctypeArray[k]}">${cardDATA[ctypeArray[k]]["title"]} card</option>`
}

document.getElementById("copybtn").addEventListener("click",
    function(event){
        const t = document.getElementById("resultlink")
        t.select()
        document.execCommand("copy");
        alert("Đã sao chép link");
    });

function renderWishSuggestions(){
    const box = document.getElementById("wish-suggestions")
    const suggestions = WISH_SUGGESTIONS[ctype.value] || []
    if (suggestions.length === 0) {
        box.innerHTML = ""
        return
    }

    let lastRegion = null
    box.innerHTML = `<small class="text-muted d-block mb-1">Gợi ý lời chúc (bấm để dùng):</small>` +
        suggestions.map((s, i) => {
            const regionLabel = s.region && s.region !== lastRegion
                ? `<span class="d-block text-muted mt-1" style="font-size:0.75rem">${s.region}</span>`
                : ""
            lastRegion = s.region
            return `${regionLabel}<a data-idx="${i}" class="wish-chip me-1 mb-1 d-inline-block px-2 py-1" style="cursor:pointer;font-weight:normal;font-size:0.8rem;text-decoration:none;color:#333;background:#f1f3f5;border:1px solid #dee2e6;border-radius:14px"></a>`
        }).join("")

    // Set text via textContent (not innerHTML/attribute) so quotes, emoji,
    // and any other characters in the suggestion never need escaping.
    box.querySelectorAll(".wish-chip").forEach(chip => {
        const s = suggestions[Number(chip.dataset.idx)]
        chip.textContent = s.text
        chip.addEventListener("mouseover", () => chip.style.background = "#e7e0fb")
        chip.addEventListener("mouseout", () => chip.style.background = "#f1f3f5")
        chip.addEventListener("click", () => { document.getElementById("ctext").value = s.text })
    })
}

ctype.addEventListener("change", renderWishSuggestions)
renderWishSuggestions()


function genCards(){
    const ctype = document.getElementById("ctype").value
    let chosen = ``
    const frame = document.getElementsByClassName("gen-card")[0]

    let clist = []

    clist = Object.values(cardDATA[ctype]["img"])

    for(let a=0; a < clist.length; ++a){
        chosen += `
            <div class="col">
                <div class="card h-100">
                    <img src="${clist[a].slice(1)}" class="card-img-top" alt="card">
                    <div class="card-body">
                        <h4>Mẫu ${a + 1}</h4><br>
                        <a onclick="selectCard(${a})" class="btn btn-warning" >Chọn mẫu này</a>
                    </div>
                </div>
            </div> `
    }
    frame.innerHTML = chosen
}

function parseGuestNames(){
    return document.getElementById("cguests").value
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => {
            const [name, relationship] = line.split("|").map(s => s.trim())
            return { name, relationship: relationship || null }
        })
}

document.getElementById("cphoto").addEventListener("change", function(){
    const file = this.files[0]
    const preview = document.getElementById("cphoto-preview")
    if (!file) {
        preview.style.display = "none"
        return
    }
    preview.src = URL.createObjectURL(file)
    preview.style.display = ""
})

async function uploadPhotoIfAny(eventId){
    const file = document.getElementById("cphoto").files[0]
    if (!file || !supabaseClient) return null

    const ext = file.name.split(".").pop()
    const path = `${eventId}.${ext}`

    const { error } = await supabaseClient.storage.from("card-photos").upload(path, file)
    if (error) {
        console.error(error)
        return null
    }

    return supabaseClient.storage.from("card-photos").getPublicUrl(path).data.publicUrl
}

// ---- Music trim (Web Audio API, entirely client-side) ----

const MAX_CLIP_SECONDS = 60

function formatTime(sec){
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${String(s).padStart(2, "0")}`
}

document.getElementById("cmusicfile").addEventListener("change", function(){
    const file = this.files[0]
    const ui = document.getElementById("music-trim-ui")
    const audio = document.getElementById("music-preview")
    if (!file) {
        ui.style.display = "none"
        return
    }

    audio.src = URL.createObjectURL(file)
    audio.addEventListener("loadedmetadata", function onMeta(){
        audio.removeEventListener("loadedmetadata", onMeta)
        const duration = audio.duration
        const startInput = document.getElementById("trim-start")
        const endInput = document.getElementById("trim-end")
        startInput.max = duration
        endInput.max = duration
        startInput.value = 0
        endInput.value = Math.min(duration, MAX_CLIP_SECONDS)
        document.getElementById("trim-start-label").textContent = formatTime(0)
        document.getElementById("trim-end-label").textContent = formatTime(endInput.value)
        ui.style.display = ""
    }, { once: true })
})

document.getElementById("trim-start").addEventListener("input", function(){
    const endInput = document.getElementById("trim-end")
    if (parseFloat(this.value) >= parseFloat(endInput.value)) this.value = endInput.value - 1
    if (parseFloat(endInput.value) - parseFloat(this.value) > MAX_CLIP_SECONDS) endInput.value = parseFloat(this.value) + MAX_CLIP_SECONDS
    document.getElementById("trim-start-label").textContent = formatTime(this.value)
})

document.getElementById("trim-end").addEventListener("input", function(){
    const startInput = document.getElementById("trim-start")
    if (parseFloat(this.value) <= parseFloat(startInput.value)) this.value = parseFloat(startInput.value) + 1
    if (parseFloat(this.value) - parseFloat(startInput.value) > MAX_CLIP_SECONDS) this.value = parseFloat(startInput.value) + MAX_CLIP_SECONDS
    document.getElementById("trim-end-label").textContent = formatTime(this.value)
})

function previewTrim(){
    const audio = document.getElementById("music-preview")
    const start = parseFloat(document.getElementById("trim-start").value)
    const end = parseFloat(document.getElementById("trim-end").value)
    audio.currentTime = start
    audio.play()
    const stopAtEnd = () => {
        if (audio.currentTime >= end) {
            audio.pause()
            audio.removeEventListener("timeupdate", stopAtEnd)
        }
    }
    audio.addEventListener("timeupdate", stopAtEnd)
}

function audioBufferToWavBlob(buffer){
    const numChannels = buffer.numberOfChannels
    const sampleRate = buffer.sampleRate
    const numFrames = buffer.length
    const bytesPerSample = 2
    const blockAlign = numChannels * bytesPerSample
    const dataSize = numFrames * blockAlign
    const arrayBuffer = new ArrayBuffer(44 + dataSize)
    const view = new DataView(arrayBuffer)

    function writeString(offset, str){
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
    }

    writeString(0, "RIFF")
    view.setUint32(4, 36 + dataSize, true)
    writeString(8, "WAVE")
    writeString(12, "fmt ")
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true) // PCM
    view.setUint16(22, numChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * blockAlign, true)
    view.setUint16(32, blockAlign, true)
    view.setUint16(34, 16, true)
    writeString(36, "data")
    view.setUint32(40, dataSize, true)

    const channels = []
    for (let ch = 0; ch < numChannels; ch++) channels.push(buffer.getChannelData(ch))

    let offset = 44
    for (let i = 0; i < numFrames; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
            const sample = Math.max(-1, Math.min(1, channels[ch][i]))
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
            offset += 2
        }
    }

    return new Blob([arrayBuffer], { type: "audio/wav" })
}

async function trimAudioFile(file, startSec, endSec){
    const arrayBuffer = await file.arrayBuffer()
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
    const sampleRate = audioBuffer.sampleRate
    const startSample = Math.floor(startSec * sampleRate)
    const endSample = Math.min(Math.floor(endSec * sampleRate), audioBuffer.length)
    const frameCount = endSample - startSample
    const trimmedBuffer = audioCtx.createBuffer(audioBuffer.numberOfChannels, frameCount, sampleRate)
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        trimmedBuffer.copyToChannel(audioBuffer.getChannelData(ch).subarray(startSample, endSample), ch)
    }
    return audioBufferToWavBlob(trimmedBuffer)
}

async function uploadMusicIfAny(eventId){
    const file = document.getElementById("cmusicfile").files[0]
    if (!file || !supabaseClient) return null

    const start = parseFloat(document.getElementById("trim-start").value)
    const end = parseFloat(document.getElementById("trim-end").value)

    let clipBlob
    try {
        clipBlob = await trimAudioFile(file, start, end)
    } catch (e) {
        console.error("Không cắt được file nhạc này, bỏ qua nhạc nền.", e)
        return null
    }

    const path = `${eventId}.wav`
    const { error } = await supabaseClient.storage.from("card-music").upload(path, clipBlob)
    if (error) {
        console.error(error)
        return null
    }

    return supabaseClient.storage.from("card-music").getPublicUrl(path).data.publicUrl
}

async function selectCard(no){
    const templ = no
    const cname = document.getElementById("cname").value
    const ctext = document.getElementById("ctext").value
    const ctype = document.getElementById("ctype").value
    const cdate = document.getElementById("cdate").value || null
    const ctime = document.getElementById("ctime").value || null
    const ctimeend = document.getElementById("ctimeend").value || null
    const clocation = document.getElementById("clocation").value || null
    const cnotes = document.getElementById("cnotes").value || null
    const cafterpartyOn = document.getElementById("cafterparty-toggle").checked
    const cafterpartyNote = cafterpartyOn ? (document.getElementById("cafterparty-note").value || "Đi ăn/tụ tập sau đó") : null
    const guests_input = parseGuestNames()

    const singleLinkBlock = document.getElementById("single-link-block")
    const guestLinkList = document.getElementById("guest-link-list")
    guestLinkList.innerHTML = ""

    if (!supabaseClient) {
        // Fallback: no backend configured, keep the original base64-in-URL behavior
        const enc_cname = encodeURI(window.btoa(cname))
        const enc_ctext = encodeURI(window.btoa(ctext))
        const temp = new URL(`templates/1.html?card=${ctype}&name=${enc_cname}&text=${enc_ctext}&templ=${templ}`, window.location.href).href
        showSingleLink(temp)
        singleLinkBlock.style.display = ""
        document.getElementById("msg").innerText = `Đã chọn Mẫu ${templ + 1}. Gửi link hoặc mã QR cho người nhận nhé!`
        return
    }

    // We generate the id client-side and skip .select() (no RETURNING) on purpose:
    // events/guests have no SELECT policy (anon key must never be able to list/dump
    // rows — see supabase/schema.sql), and Postgres requires a SELECT policy to
    // satisfy RETURNING, so RETURNING would make every insert fail RLS.
    const eventId = crypto.randomUUID()
    document.getElementById("msg").innerText = `Đang tạo thiệp...`
    const photoUrl = await uploadPhotoIfAny(eventId)
    const musicUrl = await uploadMusicIfAny(eventId)

    const { error } = await supabaseClient
        .from("events")
        .insert({
            id: eventId,
            card_type: ctype, template_no: templ, host_name: cname, message: ctext,
            event_date: cdate, event_time: ctime, event_time_end: ctimeend, event_location: clocation,
            notes: cnotes, afterparty_note: cafterpartyNote,
            music_url: musicUrl, photo_url: photoUrl
        })

    if (error) {
        document.getElementById("msg").innerText = "Có lỗi khi tạo thiệp, thử lại sau."
        console.error(error)
        return
    }

    if (guests_input.length === 0) {
        singleLinkBlock.style.display = ""
        const temp = new URL(`templates/1.html?event=${eventId}`, window.location.href).href
        showSingleLink(temp)
        document.getElementById("msg").innerText = `Đã chọn Mẫu ${templ + 1}. Gửi link hoặc mã QR cho người nhận nhé!`
        return
    }

    singleLinkBlock.style.display = "none"

    const guests = guests_input.map(g => ({ id: crypto.randomUUID(), event_id: eventId, guest_name: g.name, relationship: g.relationship }))

    const { error: guestError } = await supabaseClient
        .from("guests")
        .insert(guests)

    if (guestError) {
        document.getElementById("msg").innerText = "Đã tạo thiệp nhưng có lỗi khi tạo link riêng cho khách, thử lại sau."
        console.error(guestError)
        return
    }

    guestLinkList.innerHTML = `<p>Mỗi khách có 1 link riêng, tên tự điền sẵn:</p>` + guests.map(g => {
        const link = new URL(`templates/1.html?event=${eventId}&guest=${g.id}`, window.location.href).href
        return `
            <div class="input-group mb-2">
                <span class="input-group-text">${g.guest_name}</span>
                <input type="text" class="form-control" readonly value="${link}">
                <button class="btn btn-outline-secondary" type="button" onclick="navigator.clipboard.writeText('${link}')">Sao chép</button>
            </div>`
    }).join("")

    document.getElementById("msg").innerText = `Đã chọn Mẫu ${templ + 1}. Gửi link riêng cho từng khách ở trên.`
}

function showSingleLink(temp){
    const res = document.getElementById("resultlink")
    res.value = temp

    var qr = new QRious({
        level: 'M',
        padding: 25,
        size: 320,
        element: document.getElementById('qr'),
        value: temp
    });
}

/*
TOPICS :=====
    Birthday
    Dinner Party
    Wedding
    Christmas Party
    Teacher Appreciation
    Thank You
    Anniversary
    Congratulations
    Get Well
    Friendship
    Love
    Sorry
*/
