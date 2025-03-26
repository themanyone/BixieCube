var text = "Welcome!",
wt = document.querySelector(".wavetext");
text.split('').forEach(function(i){
    wt.innerHTML+="<span>"+i.replace(/ /g,"&nbsp;")+"</span>";
});
text = "Congratulations!";
window.setTimeout(function(){
    // Hide wavetext element
    wt.style.display = "none";
    wt.innerHTML = "";
    text.split('').forEach(function(i){
        wt.innerHTML+="<span>"+i.replace(/ /g,"&nbsp;")+"</span>";
    });
}
, 20000);