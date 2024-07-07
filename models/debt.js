const mongoose = require('mongoose')
const Schema = mongoose.Schema

const debtSchema = new mongoose.Schema({
    pencatat: {  //data disi dengan id pencatat/user
        type: String,
        required: [true, 'Writer is required'],
    },
    pemberi: {
        type: String,
        required: [true, 'Pemberi hutang is required']
    },
    jumlah: {
        type: Schema.Types.Decimal128,
        required: [true, 'Jumlah hutang is required'],
    },
    bunga: {
        type: Number,
    },
    tgl_hutang: {
        type: Date,
        required: [true, 'tanggal berhutang is required']
    },
    lunas_pada: {
        type: Date,
        default: null
    },
    deadline: {
        type: Date
    },
    catatan: {
        type: String
    },
    status: {
        type: String,
        required: [true, 'Status is required']
    },
    create_on: { //default tanggal kapan dibuat
        type: Date,
        required: true,
        default: Date.now
    }
})

module.exports = mongoose.model('Debt', debtSchema)