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
        alert("URL copied");
    });


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
                        <h4>Card ${a}</h4><br>
                        <a onclick="selectCard(${a})" class="btn btn-warning" >Select this</a>
                    </div>
                </div>
            </div> `
    }
    frame.innerHTML = chosen
}

async function selectCard(no){
    const templ = no
    const cname = document.getElementById("cname").value
    const ctext = document.getElementById("ctext").value
    const ctype = document.getElementById("ctype").value
    const res = document.getElementById("resultlink")

    let temp

    if (supabaseClient) {
        const { data, error } = await supabaseClient
            .from("events")
            .insert({ card_type: ctype, template_no: templ, host_name: cname, message: ctext })
            .select()
            .single()

        if (error) {
            document.getElementById("msg").innerText = "Có lỗi khi tạo thiệp, thử lại sau."
            console.error(error)
            return
        }

        temp = new URL(`templates/1.html?event=${data.id}`, window.location.href).href
    } else {
        // Fallback: no backend configured, keep the original base64-in-URL behavior
        const enc_cname = encodeURI(window.btoa(cname))
        const enc_ctext = encodeURI(window.btoa(ctext))
        temp = new URL(`templates/1.html?card=${ctype}&name=${enc_cname}&text=${enc_ctext}&templ=${templ}`, window.location.href).href
    }

    res.value = temp

    // Generate QR code

    var qr = new QRious({
        level: 'M',
        padding: 25,
        size: 320,
        element: document.getElementById('qr'),
        value: temp
    });

    document.getElementById("msg").innerText = `Card ${templ} is Selected. Send the link or the QR Code to the person`
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
