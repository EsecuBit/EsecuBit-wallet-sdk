
function component2() {
    var element = document.createElement('div');

    // Lodash（目前通过一个 script 脚本引入）对于执行这一行是必需的
    element.innerHTML = ['Hello', 'webpack2'].join(' ');
    return element;
}

document.body.appendChild(component2());